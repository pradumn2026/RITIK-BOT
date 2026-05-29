const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");

module.exports.config = {
    name: "music",
    version: "2.0.5",
    hasPermssion: 0,
    credits: "Shaan Khan",
    description: "Download Audio or Video",
    commandCategory: "Media",
    usages: "[name] or [name] video",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID } = event;

    // 🔑 API KEY
    const PRIYANSHU_API_KEY = "apim_aHDn_W3Yag8_LgS2TdKQIOK4awIAZPgRWwsye4BsyTo"; 

    if (!args.length) {
        return api.sendMessage("❌ Please enter a song name or YouTube URL.", threadID, messageID);
    }

    let input = args.join(" ");
    let isVideo = false;

    if (input.toLowerCase().endsWith(" video")) {
        isVideo = true;
        input = input.slice(0, -6).trim(); 
    }

    const cacheDir = path.join(__dirname, "cache");
    const extension = isVideo ? "mp4" : "mp3";
    const fileName = `${Date.now()}.${extension}`;
    const cachePath = path.join(cacheDir, fileName);

    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    let processingMsg;
    try {
        api.setMessageReaction("⌛", messageID, (err) => {}, true);
        processingMsg = await api.sendMessage("✅ Apki Request Jari Hai Please Wait...", threadID);

        const searchResult = await ytSearch(input);
        if (!searchResult || !searchResult.videos.length) {
            api.setMessageReaction("❌", messageID, (err) => {}, true);
            if (processingMsg) api.unsendMessage(processingMsg.messageID);
            return api.sendMessage("❌ Song/Video not found.", threadID);
        }
        
        const video = searchResult.videos[0];
        const videoUrl = video.url;

        const apiUrl = `https://priyanshuapi.xyz/api/runner/youtube-downloader-v2/download`;
        const payload = {
            url: videoUrl,
            format: isVideo ? "mp4" : "mp3",
            quality: isVideo ? "360" : "320"
        };

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${PRIYANSHU_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        const data = response.data.data;
        if (!data || !data.downloadUrl) throw new Error("Download link not found.");

        const infoMsg = `🖤 𝗧𝗶𝘁𝗹𝗲: ${video.title}\n\n👤 𝗔𝗿𝘁𝗶𝘀𝘁: ${video.author.name}\n\n»»𝑶𝑾𝑵𝑬𝑹««★™ »»𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐄𝐆𝐇𝐖𝐀𝐍𝐒𝐈««\n🥀𝒀𝑬 𝑳𝑶 𝑩𝑨𝑩𝒀 𝑨𝑷𝑲𝑰     👉 ${isVideo ? "VIDEO" : "SONG"}`;

        const writer = fs.createWriteStream(cachePath);
        const streamResponse = await axios({
            url: data.downloadUrl,
            method: 'GET',
            responseType: 'stream'
        });

        streamResponse.data.pipe(writer);

        writer.on("finish", async () => {
            const stats = fs.statSync(cachePath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB > 48) {
                api.setMessageReaction("❌", messageID, (err) => {}, true);
                if (processingMsg) api.unsendMessage(processingMsg.messageID);
                return api.sendMessage(`⚠️ File size (${fileSizeInMB.toFixed(2)}MB) is too large.`, threadID);
            }

            // Logic: Audio ke liye alag text, Video ke liye sath mein text
            if (isVideo) {
                // Video ke liye title ke saath send karein
                api.sendMessage({
                    body: infoMsg,
                    attachment: fs.createReadStream(cachePath)
                }, threadID, (err) => {
                    if (!err) api.setMessageReaction("✅", messageID, (err) => {}, true);
                    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                    if (processingMsg) api.unsendMessage(processingMsg.messageID);
                });
            } else {
                // Audio ke liye pehle details (No Reply)
                await api.sendMessage(infoMsg, threadID);
                // Phir audio file (No Reply)
                api.sendMessage({
                    attachment: fs.createReadStream(cachePath)
                }, threadID, (err) => {
                    if (!err) api.setMessageReaction("✅", messageID, (err) => {}, true);
                    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                    if (processingMsg) api.unsendMessage(processingMsg.messageID);
                });
            }
        });

    } catch (error) {
        console.error(error);
        api.setMessageReaction("❌", messageID, (err) => {}, true);
        if (processingMsg) api.unsendMessage(processingMsg.messageID);
        api.sendMessage(`❌ Failed: ${error.message}`, threadID);
    }
};
