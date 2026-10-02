const fs = require("fs");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");

module.exports.config = {
    name: "song",
    aliases: ["songs"],
    version: "1.0.0",
    hasPrefix: true,
    permission: 'PUBLIC',
    credit: "𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭",
    description: "Search and download music from YouTube",
    category: "MEDIA",
    usages: "[song name]",
    cooldown: 5,
};

module.exports.run = async function ({ api, message, args }) {
    const { threadID, messageID, senderID } = message;
    const input = args.join(" ");

    if (!input) {
        return api.sendMessage("❌ Please enter a song name.", threadID, messageID);
    }

    try {
        // Removed "Searching..." message as requested

        const searchResults = await ytSearch(input);
        if (!searchResults || !searchResults.videos.length) {
            return api.sendMessage("❌ No results found.", threadID, messageID);
        }

        const results = searchResults.videos.slice(0, 6);
        const thumbDir = path.join(__dirname, "temp");
        if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

        let msg = "🎧 Top 6 results:\n\n";
        const attachments = [];
        const thumbnailPaths = [];

        for (let i = 0; i < results.length; i++) {
            const video = results[i];
            const thumbURL = video.thumbnail;
            const thumbPath = path.join(thumbDir, `thumb-${video.videoId}-${Date.now()}.jpg`);

            try {
                const thumbData = await axios.get(thumbURL, { responseType: "arraybuffer" });
                fs.writeFileSync(thumbPath, thumbData.data);
                attachments.push(fs.createReadStream(thumbPath));
                thumbnailPaths.push(thumbPath);
            } catch (e) {
                console.error("Error downloading thumbnail:", e);
            }

            msg += `${i + 1}. ${video.title} (${video.timestamp})\n`;
            msg += `📻 ${video.author.name} | 👁 ${video.views}\n\n`;
        }

        msg += "👉 Reply with the number to download.";

        api.sendMessage(
            {
                body: msg,
                attachment: attachments,
            },
            threadID,
            (err, info) => {
                if (err) return console.error("Send failed:", err);

                global.client.replies.set(threadID, [
                    ...(global.client.replies.get(threadID) || []),
                    {
                        command: this.config.name,
                        messageID: info.messageID,
                        expectedSender: senderID,
                        data: {
                            results,
                            messageIDToDelete: info.messageID,
                            thumbnailPaths
                        }
                    }
                ]);

                // Cleanup thumbnails after sending (give some time for the message to be sent)
                setTimeout(() => {
                    thumbnailPaths.forEach(p => {
                        if (fs.existsSync(p)) fs.unlink(p, () => { });
                    });
                }, 60 * 1000);
            },
            messageID
        );

    } catch (error) {
        console.error("Error in songv2 command:", error);
        api.sendMessage("❌ An error occurred.", threadID, messageID);
    }
};

module.exports.handleReply = async function ({ api, message, replyData }) {
    const { threadID, messageID, body } = message;
    const index = parseInt(body.trim());

    if (!replyData.results || isNaN(index) || index < 1 || index > replyData.results.length) {
        return api.sendMessage("❌ Please reply with a valid number.", threadID, messageID);
    }

    const video = replyData.results[index - 1];
    const videoUrl = video.url;
    const apiKey = global.config.apiKeys?.priyanshuApi;

    if (!apiKey) {
        return api.sendMessage("❌ API key not found in config.", threadID, messageID);
    }

    // Unsend the list message
    if (replyData.messageIDToDelete) {
        api.unsendMessage(replyData.messageIDToDelete);
    }

    const processingMsg = await api.sendMessage(`⏳ Processing: ${video.title}...`, threadID, messageID);

    try {
        // Call the API
        const apiUrl = "https://priyanshuapi.qzz.io/api/runner/youtube-downloader-v2/download";
        const response = await axios.post(
            apiUrl,
            {
                link: videoUrl,
                format: "mp3",
                videoQuality: "360",
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.data || !response.data.success || !response.data.data) {
            api.unsendMessage(processingMsg.messageID);
            return api.sendMessage("❌ Failed to generate download link.", threadID, messageID);
        }

        const { downloadUrl, title, filename } = response.data.data;
        // Use video.title from search result as primary if API title is generic "YouTube Video"
        let finalTitle = title;
        if (!finalTitle || finalTitle === "YouTube Video" || finalTitle === "Unknown Title") {
            finalTitle = video.title;
        }

        // Check file size
        try {
            const headResponse = await axios.head(downloadUrl);
            const contentLength = headResponse.headers["content-length"];
            if (contentLength && parseInt(contentLength) > 30 * 1024 * 1024) {
                api.unsendMessage(processingMsg.messageID);
                return api.sendMessage("❌ File size exceeds 30MB limit.", threadID, messageID);
            }
        } catch (headError) {
            console.error("Error checking file size:", headError);
        }

        // Format views
        const formattedViews = video.views ? new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(video.views) : "N/A";

        // Send info message
        let infoMsg = `🎵 Title: ${finalTitle}\n`;
        if (video.timestamp) infoMsg += `⏱ Duration: ${video.timestamp}\n`;
        if (video.author && video.author.name) infoMsg += `👤 Artist: ${video.author.name}\n`;
        if (video.views) infoMsg += `👀 Views: ${formattedViews}\n`;
        if (video.ago) infoMsg += `📅 Uploaded: ${video.ago}\n`;
        infoMsg += `🔗 Source: ${videoUrl}\n`;
        infoMsg += `📥 Download Link: ${downloadUrl}\n`;
        infoMsg += `⏳ Downloading...`;

        api.sendMessage(infoMsg, threadID, () => {
            api.unsendMessage(processingMsg.messageID);
        });

        // Download file
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const safeFilename = (filename || `${Date.now()}.mp3`).replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = path.join(tempDir, safeFilename);

        const writer = fs.createWriteStream(filePath);
        const downloadResponse = await axios({
            method: "GET",
            url: downloadUrl,
            responseType: "stream",
        });

        downloadResponse.data.pipe(writer);

        writer.on("finish", () => {
            // Verify file is not empty before sending
            fs.stat(filePath, (statErr, stats) => {
                if (statErr || !stats || stats.size === 0) {
                    console.error("[song] Temp file is empty or unreadable, skipping send:", filePath, statErr);
                    api.sendMessage("❌ Download failed (empty file). Please try again.", threadID, messageID);
                    return fs.unlink(filePath, () => { });
                }

                // Send the file
                api.sendMessage(
                    {
                        body: `🎧 ${finalTitle}`,
                        attachment: fs.createReadStream(filePath),
                    },
                    threadID,
                    (err) => {
                        if (err) {
                            console.error("Error sending file:", err);
                            api.sendMessage("❌ Failed to send audio file.", threadID, messageID);
                        }
                        // Delete file after sending
                        fs.unlink(filePath, (unlinkErr) => {
                            if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
                        });
                    }
                );
            });
        });

        writer.on("error", (err) => {
            console.error("Error downloading file:", err);
            api.sendMessage("❌ Failed to download the file.", threadID, messageID);
            fs.unlink(filePath, () => { });
        });

    } catch (error) {
        console.error("Error in songv2 command:", error);
        api.sendMessage("❌ An error occurred.", threadID, messageID);
    }
};
