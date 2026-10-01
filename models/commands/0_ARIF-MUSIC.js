"use strict";

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");

module.exports.config = {
    name: "music",
    version: "3.0.0",
    hasPermssion: 0,
    credits: "Shaan Khan / Cleaned Version",
    description: "Download YouTube audio or video",
    commandCategory: "Media",
    usages: "[song name / YouTube URL] [video]",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID } = event;

    if (!args || !args.length) {
        return api.sendMessage(
            "❌ Please enter a song name or YouTube URL.\n\nExample:\n.music Tum Hi Ho\n.music Tum Hi Ho video",
            threadID,
            messageID
        );
    }

    // API key should be stored in .env:
    // PRIYANSHU_API_KEY=your_api_key_here
    const API_KEY = process.env.PRIYANSHU_API_KEY;

    if (!API_KEY) {
        console.error("PRIYANSHU_API_KEY is missing.");
        return api.sendMessage(
            "❌ API configuration error. Please contact the bot administrator.",
            threadID,
            messageID
        );
    }

    let input = args.join(" ").trim();

    // Detect "video" at the end of the command
    const isVideo = /\s+video$/i.test(input);

    if (isVideo) {
        input = input.replace(/\s+video$/i, "").trim();
    }

    if (!input) {
        return api.sendMessage(
            "❌ Please enter a valid song name or YouTube URL.",
            threadID,
            messageID
        );
    }

    const cacheDir = path.join(__dirname, "cache");

    await fs.ensureDir(cacheDir);

    const extension = isVideo ? "mp4" : "mp3";
    const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}.${extension}`;

    const cachePath = path.join(cacheDir, fileName);

    let processingMsg = null;

    const cleanup = async () => {
        try {
            if (await fs.pathExists(cachePath)) {
                await fs.remove(cachePath);
            }
        } catch (err) {
            console.error("Cleanup error:", err.message);
        }

        try {
            if (processingMsg?.messageID) {
                api.unsendMessage(processingMsg.messageID, () => {});
            }
        } catch (err) {
            console.error("Message cleanup error:", err.message);
        }
    };

    const setReaction = (emoji) => {
        try {
            api.setMessageReaction(
                emoji,
                messageID,
                () => {},
                true
            );
        } catch (err) {
            console.error("Reaction error:", err.message);
        }
    };

    try {
        setReaction("⌛");

        processingMsg = await api.sendMessage(
            "✅ Aapki request process ho rahi hai...\n⏳ Please wait.",
            threadID
        );

        /*
         * ---------------------------------------------------------
         * SEARCH YOUTUBE
         * ---------------------------------------------------------
         */

        let video;

        // If user directly provides a YouTube URL,
        // don't perform unnecessary search.
        const isYouTubeUrl =
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(input);

        if (isYouTubeUrl) {
            video = {
                url: input,
                title: "YouTube Video",
                author: {
                    name: "YouTube"
                }
            };
        } else {
            const searchResult = await ytSearch(input);

            if (
                !searchResult ||
                !Array.isArray(searchResult.videos) ||
                searchResult.videos.length === 0
            ) {
                setReaction("❌");

                await cleanup();

                return api.sendMessage(
                    "❌ Song/Video not found.",
                    threadID,
                    messageID
                );
            }

            video = searchResult.videos[0];
        }

        const videoUrl = video.url;

        /*
         * ---------------------------------------------------------
         * DOWNLOADER API
         * ---------------------------------------------------------
         */

        const apiUrl =
            "https://priyanshuapi.xyz/api/runner/youtube-downloader-v2/download";

        const payload = {
            url: videoUrl,
            format: isVideo ? "mp4" : "mp3",
            quality: isVideo ? "360" : "320"
        };

        const response = await axios.post(apiUrl, payload, {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            timeout: 60000,
            validateStatus: (status) => status >= 200 && status < 300
        });

        const data = response?.data?.data;

        if (!data || !data.downloadUrl) {
            throw new Error("Downloader API did not return a download URL.");
        }

        /*
         * ---------------------------------------------------------
         * DOWNLOAD FILE
         * ---------------------------------------------------------
         */

        const streamResponse = await axios.get(data.downloadUrl, {
            responseType: "stream",
            timeout: 120000,
            maxRedirects: 5,
            validateStatus: (status) =>
                status >= 200 && status < 300
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(cachePath);

            let settled = false;

            const fail = (error) => {
                if (settled) return;

                settled = true;

                try {
                    writer.destroy();
                } catch (_) {}

                reject(error);
            };

            streamResponse.data.on("error", fail);
            writer.on("error", fail);

            writer.on("finish", () => {
                if (settled) return;

                settled = true;
                resolve();
            });

            streamResponse.data.pipe(writer);
        });

        /*
         * ---------------------------------------------------------
         * FILE CHECK
         * ---------------------------------------------------------
         */

        if (!(await fs.pathExists(cachePath))) {
            throw new Error("Downloaded file was not created.");
        }

        const stats = await fs.stat(cachePath);

        if (!stats.size) {
            throw new Error("Downloaded file is empty.");
        }

        // Messenger bot attachment limit
        const MAX_FILE_SIZE = 48 * 1024 * 1024;

        if (stats.size > MAX_FILE_SIZE) {
            const fileSizeMB = (
                stats.size /
                (1024 * 1024)
            ).toFixed(2);

            setReaction("❌");

            await cleanup();

            return api.sendMessage(
                `⚠️ File size ${fileSizeMB} MB hai.\n` +
                `Maximum allowed size: 48 MB.\n\n` +
                `Please try another song/video.`,
                threadID,
                messageID
            );
        }

        /*
         * ---------------------------------------------------------
         * MESSAGE
         * ---------------------------------------------------------
         */

        const title = video.title || "Unknown Title";
        const artist =
            video.author?.name || "Unknown Artist";

        const infoMsg =
            `🖤 𝗧𝗶𝘁𝗹𝗲: ${title}\n\n` +
            `👤 𝗔𝗿𝘁𝗶𝘀𝘁: ${artist}\n\n` +
            `»»𝑶𝑾𝑵𝑬𝑹««★™\n` +
            `»»𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐄𝐆𝐇𝐖𝐀𝐍𝐒𝐈««\n\n` +
            `🥀 𝒀𝑬 𝑳𝑶 𝑩𝑨𝑩𝒀 𝑨𝑷𝑲𝑰 👉 ` +
            `${isVideo ? "VIDEO" : "SONG"}`;

        /*
         * ---------------------------------------------------------
         * SEND FILE
         * ---------------------------------------------------------
         */

        if (isVideo) {
            // Video: title + attachment together
            await new Promise((resolve, reject) => {
                api.sendMessage(
                    {
                        body: infoMsg,
                        attachment: fs.createReadStream(cachePath)
                    },
                    threadID,
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        } else {
            // Audio: information first
            await api.sendMessage(infoMsg, threadID);

            // Then MP3
            await new Promise((resolve, reject) => {
                api.sendMessage(
                    {
                        attachment: fs.createReadStream(cachePath)
                    },
                    threadID,
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        }

        setReaction("✅");

    } catch (error) {
        console.error(
            "[MUSIC ERROR]",
            error?.response?.data || error
        );

        setReaction("❌");

        let errorMessage = "❌ Download failed.";

        if (error.code === "ECONNABORTED") {
            errorMessage =
                "❌ Request timeout ho gaya.\nPlease try again.";
        } else if (error.response?.status === 401) {
            errorMessage =
                "❌ API key invalid ya expired hai.";
        } else if (error.response?.status === 429) {
            errorMessage =
                "❌ API rate limit reached.\nPlease try again later.";
        } else if (error.response?.status >= 500) {
            errorMessage =
                "❌ Downloader server temporarily unavailable.";
        } else if (error.message) {
            errorMessage =
                `❌ Failed: ${error.message}`;
        }

        try {
            await api.sendMessage(
                errorMessage,
                threadID,
                messageID
            );
        } catch (sendError) {
            console.error(
                "Error message send failed:",
                sendError.message
            );
        }
    } finally {
        // Always delete temporary downloaded file
        try {
            if (await fs.pathExists(cachePath)) {
                await fs.remove(cachePath);
            }
        } catch (cleanupError) {
            console.error(
                "Final cleanup error:",
                cleanupError.message
            );
        }

        // Remove "processing" message
        try {
            if (processingMsg?.messageID) {
                api.unsendMessage(
                    processingMsg.messageID,
                    () => {}
                );
            }
        } catch (err) {
            console.error(
                "Processing message cleanup error:",
                err.message
            );
        }
    }
};

".env" में API key

Project की root directory में ".env" बनाकर:

PRIYANSHU_API_KEY=YOUR_NEW_API_KEY_HERE

और अगर "dotenv" पहले से installed नहीं है:

npm install dotenv

फिर "music.js" की सबसे ऊपर वाली lines में यह जोड़ें:

require("dotenv").config();

पुरानी exposed API key को इस्तेमाल जारी न रखें; उसे rotate/revoke करके नई key लगाना बेहतर है।

इस version में ".music song name", ".music song name video", और direct YouTube URL दोनों संभाले गए हैं।
