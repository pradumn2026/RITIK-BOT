const axios = require("axios");
const fs = require("fs");
const path = require("path");

// API Endpoints
const AUDIO_API = "https://uzairrajputapis.qzz.io/api/downloader/ytmp3";
const YT_SEARCH = "https://uzairrajputapis.qzz.io/api/search/youtube";

function getVideoID(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

module.exports = {
  config: {
    name: "song",
    aliases: ["music", "sing"],
    version: "1.0.0",
    description: "YouTube song downloader (No Prefix)",
    usage: "song [Song Name or Link]",
    credit: "𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭",
    hasPrefix: false,
    permission: "PUBLIC",
    cooldown: 5,
    category: "UTILITY"
  },

  run: async function({ api, message, args }) {
    const { threadID, messageID } = message;
    const query = args.join(" ");

    if (!query) {
      return api.sendMessage("❌ Please provide a song name or YouTube link!", threadID, messageID);
    }

    // Ensure cache directory exists
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const tempPath = path.join(cacheDir, `song_${Date.now()}.mp3`);
    let searchMsgID;

    try {
      // 1. Send searching status
      const info = await api.sendMessage("🔍 Searching for your song, please wait...", threadID, messageID);
      searchMsgID = info.messageID;

      let videoUrl = query;
      let songTitle = "Music";

      // 2. YouTube Search Logic (if input is not a direct URL)
      if (!getVideoID(query)) {
        const searchResponse = await axios.get(YT_SEARCH, { params: { q: query } });
        const video = searchResponse.data?.result?.[0] || searchResponse.data?.result?.items?.[0] || searchResponse.data?.data?.[0];
        
        if (!video) {
          if (searchMsgID) api.unsendMessage(searchMsgID);
          return api.sendMessage("❌ No results found for your query.", threadID, messageID);
        }
        videoUrl = video.url || `https://www.youtube.com/watch?v=${video.id}`;
        songTitle = video.title || "audio";
      }

      // 3. Get Download Link from API
      // Using POST as per your API requirements
      const downloadResponse = await axios.post(AUDIO_API, { url: videoUrl });
      const songData = downloadResponse.data?.result || downloadResponse.data?.data || downloadResponse.data;
      
      const downloadLink = songData.download_url || songData.video || songData.url || songData.link;

      if (!downloadLink) {
        if (searchMsgID) api.unsendMessage(searchMsgID);
        return api.sendMessage("⚠️ Could not generate a download link. The API might be down.", threadID, messageID);
      }

      // 4. Download file to local cache
      const response = await axios({
        method: 'get',
        url: downloadLink,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // 5. Remove "searching" message
      if (searchMsgID) api.unsendMessage(searchMsgID);

      // 6. Send Title and Credits first
      const finalTitle = songData.title || songTitle;
      const successText = `🖤 Title: ${finalTitle}\n\n━━━━━━━━━━━━━\n✨ »»𝑶𝑾𝑵𝑬𝑹««★™ »»𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐄𝐆𝐇𝐖𝐀𝐍𝐒𝐈««🥀𝒀𝑬 𝑳𝑶 𝑩𝑨𝑩𝒀 𝑨𝑷𝑲𝑰👉SONG`;
      
      await api.sendMessage(successText, threadID);

      // 7. Send the Audio File
      return api.sendMessage({
        attachment: fs.createReadStream(tempPath)
      }, threadID, () => {
        // Cleanup: Delete file after sending
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      });

    } catch (error) {
      if (searchMsgID) api.unsendMessage(searchMsgID);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      
      console.error(error);
      return api.sendMessage(`⚠️ Error: ${error.message || "Server is not responding!"}`, threadID, messageID);
    }
  }
};
