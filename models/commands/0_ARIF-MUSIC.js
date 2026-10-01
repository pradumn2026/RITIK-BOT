"use strict";

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");

module.exports.config = {
    name: "music",
    version: "4.0.0",
    hasPermssion: 0,
    credits: "Prince Meghwansi",
    description: "Download YouTube audio or video",
    commandCategory: "Media",
    usages: "[song name / YouTube URL] [video]",
    cooldowns: 5
};

const API_BASE = "http://65.21.202.154:25456";

module.exports.run = async function ({ api, event, args }) {

    const { threadID, messageID } = event;

    if (!args || !args.length) {
        return api.sendMessage(
            "❌ Song name ya YouTube URL do.\n\nExample:\n.music Tum Hi Ho\n.music Tum Hi Ho video",
            threadID,
            messageID
        );
    }

    let input = args.join(" ").trim();

    const isVideo = /\s+video$/i.test(input);

    if (isVideo) {
        input = input.replace(/\s+video$/i, "").trim();
    }

    if (!input) {
        return api.sendMessage(
            "❌ Valid song name ya YouTube URL do.",
            threadID,
            messageID
        );
    }

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);

    const extension = isVideo ? "mp4" : "mp3";

    const fileName =
        `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;

    const cachePath = path.join(cacheDir, fileName);

    let processingMsg = null;

    const cleanup = async () => {
        try {
            if (await fs.pathExists(cachePath)) {
                await fs.remove(cachePath);
            }
        } catch (e) {
            console.error("Cleanup:", e.message);
        }
    };

    const reaction = (emoji) => {
        try {
            api.setMessageReaction(
                emoji,
                messageID,
                () => {},
                true
            );
        } catch (_) {}
    };

    try {

        reaction("⌛");

        processingMsg = await api.sendMessage(
            "✅ Request process ho rahi hai...\n⏳ Please wait.",
            threadID
        );

        /*
        =========================
        YOUTUBE SEARCH
        =========================
        */

        let video;

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
                !searchResult.videos ||
                !searchResult.videos.length
            ) {
                reaction("❌");

                await cleanup();

                return api.sendMessage(
                    "❌ Song/Video nahi mila.",
                    threadID,
                    messageID
                );
            }

            video = searchResult.videos[0];
        }

        const videoUrl = video.url;

        console.log("[MUSIC] YouTube URL:", videoUrl);

        /*
        =========================
        YOUR FLASK API
        =========================
        */

        const type = isVideo ? "video" : "audio";

        const downloadApi =
            `${API_BASE}/download?url=${encodeURIComponent(videoUrl)}&type=${type}`;

        console.log("[MUSIC] API:", downloadApi);

        const response = await axios.get(downloadApi, {
            timeout: 180000,
            validateStatus: () => true
        });

        console.log("[MUSIC] API status:", response.status);
        console.log("[MUSIC] API response:", response.data);

        if (response.status !== 200) {
            throw new Error(
                `Music API HTTP ${response.status}: ${JSON.stringify(response.data)}`
            );
        }

        /*
        =========================
        FIND DOWNLOAD URL
        =========================
        */

        let downloadUrl = null;

        const data = response.data;

        if (typeof data === "string") {
            downloadUrl = data;
        }

        if (data && typeof data === "object") {

            downloadUrl =
                data.download_url ||
                data.downloadUrl ||
                data.url ||
                data.link ||
                data.file ||
                data.file_url ||
                data.fileUrl;

            if (!downloadUrl && data.data) {
                downloadUrl =
                    data.data.download_url ||
                    data.data.downloadUrl ||
                    data.data.url ||
                    data.data.link ||
                    data.data.file ||
                    data.data.file_url ||
                    data.data.fileUrl;
            }
        }

        if (!downloadUrl) {
            throw new Error(
                "API ne download URL return nahi kiya."
            );
        }

        /*
        =========================
        RELATIVE URL FIX
        =========================
        */

        if (downloadUrl.startsWith("/")) {
            downloadUrl = API_BASE + downloadUrl;
        }

        if (
            !downloadUrl.startsWith("http://") &&
            !downloadUrl.startsWith("https://")
        ) {
            downloadUrl = API_BASE + "/" + downloadUrl;
        }

        console.log("[MUSIC] File URL:", downloadUrl);

        /*
        =========================
        DOWNLOAD FILE
        =========================
        */

        const fileResponse = await axios.get(downloadUrl, {
            responseType: "stream",
            timeout: 180000,
            maxRedirects: 10,
            validateStatus: (status) =>
                status >= 200 && status < 300
        });

        await new Promise((resolve, reject) => {

            const writer = fs.createWriteStream(cachePath);

            fileResponse.data.pipe(writer);

            fileResponse.data.on("error", reject);

            writer.on("error", reject);

            writer.on("finish", resolve);
        });

        /*
        =========================
        FILE CHECK
        =========================
        */

        if (!(await fs.pathExists(cachePath))) {
            throw new Error("Downloaded file create nahi hui.");
        }

        const stats = await fs.stat(cachePath);

        if (!stats.size) {
            throw new Error("Downloaded file empty hai.");
        }

        const MAX_SIZE = 48 * 1024 * 1024;

        if (stats.size > MAX_SIZE) {

            const sizeMB =
                (stats.size / (1024 * 1024)).toFixed(2);

            reaction("❌");

            await cleanup();

            return api.sendMessage(
                `⚠️ File ${sizeMB} MB ki hai.\n` +
                `Maximum limit 48 MB hai.`,
                threadID,
                messageID
            );
        }

        /*
        =========================
        MESSAGE
        =========================
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
        =========================
        SEND TO MESSENGER
        =========================
        */

        await api.sendMessage(
            {
                body: infoMsg,
                attachment: fs.createReadStream(cachePath)
            },
            threadID
        );

        reaction("✅");

    } catch (error) {

        console.error(
            "[MUSIC ERROR]",
            error?.response?.data || error.message || error
        );

        reaction("❌");

        let msg =
            "❌ Download failed.";

        if (error.code === "ECONNABORTED") {

            msg =
                "❌ Download timeout ho gaya.\n" +
                "Thodi der baad dobara try karo.";

        } else if (
            error.response?.status === 404
        ) {

            msg =
                "❌ Music API file nahi de pa rahi.\n" +
                "Bot-Hosting API response check karo.";

        } else if (
            error.response?.status >= 500
        ) {

            msg =
                "❌ Music API server error.\n" +
                "Bot-Hosting console check karo.";

        } else if (error.message) {

            msg =
                `❌ ${error.message}`;
        }

        try {
            await api.sendMessage(
                msg,
                threadID,
                messageID
            );
        } catch (_) {}
        
    } finally {

        await cleanup();

        try {
            if (processingMsg?.messageID) {
                api.unsendMessage(
                    processingMsg.messageID,
                    () => {}
                );
            }
        } catch (_) {}
    }
};
