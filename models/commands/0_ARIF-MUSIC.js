const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const ytSearch = require("yt-search");

module.exports = {
  config: {
    name: "music",
    version: "2.0.0",
    hasPermssion: 0,
    credits: "AADI SHRIVTASTAV", // Credit unchanged
    description: "Download YouTube audio/video from search",
    commandCategory: "Media",
    usages: ".music [song name] [audio/video]",
    cooldowns: 5,
    dependencies: {
      axios: "",
      "fs-extra": "",
      "yt-search": ""
    }
  },

  run: async function ({ api, event, args }) {

    const { threadID, messageID } = event;

    if (!args[0]) {
      return api.sendMessage(
        "❌ Please enter song name.\n\nExample:\n.music alan walker\n.music alan walker video",
        threadID,
        messageID
      );
    }

    // Detect type
    let type = "audio";

    if (
      args[args.length - 1].toLowerCase() === "video" ||
      args[args.length - 1].toLowerCase() === "audio"
    ) {
      type = args.pop().toLowerCase();
    }

    const songName = args.join(" ");

    const loadingFrames = [
      "▰▱▱▱▱▱▱▱▱▱ 10%",
      "▰▰▱▱▱▱▱▱▱▱ 20%",
      "▰▰▰▰▱▱▱▱▱▱ 40%",
      "▰▰▰▰▰▰▱▱▱▱ 70%",
      "▰▰▰▰▰▰▰▰▰▰ 100%"
    ];

    // Loading message
    const loading = await api.sendMessage(
      `🔍 Searching Song...\n\n${loadingFrames[0]}`,
      threadID
    );

    try {

      // SEARCH SONG
      const searchResults = await ytSearch(songName);

      if (!searchResults.videos.length) {
        api.unsendMessage(loading.messageID);

        return api.sendMessage(
          "❌ No song found.",
          threadID,
          messageID
        );
      }

      const song = searchResults.videos[0];

      const title = song.title;
      const videoId = song.videoId;
      const duration = song.timestamp;
      const views = song.views;
      const channel = song.author.name;
      const thumbnail = song.thumbnail;
      const url = song.url;

      // Update loading
      await api.editMessage(
        `🎶 Found:\n${title}\n\n${loadingFrames[1]}`,
        loading.messageID,
        threadID
      );

      // API URL
      const apiKey = "priyansh-here";

      const apiUrl =
        `https://priyanshu-ai.onrender.com/youtube?id=${videoId}&type=${type}&apikey=${apiKey}`;

      // Fetch download link
      const res = await axios.get(apiUrl, {
        timeout: 120000
      });

      if (!res.data || !res.data.downloadUrl) {

        api.unsendMessage(loading.messageID);

        return api.sendMessage(
          "❌ Failed to get download link.",
          threadID,
          messageID
        );
      }

      const downloadUrl = res.data.downloadUrl;

      // Update loading
      await api.editMessage(
        `📥 Downloading ${type}...\n\n${loadingFrames[2]}`,
        loading.messageID,
        threadID
      );

      // Download file
      const fileRes = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: 300000,
        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }
      });

      // Cache folder
      const cacheDir = path.join(__dirname, "cache");

      await fs.ensureDir(cacheDir);

      // File extension
      const ext = type === "audio" ? "mp3" : "mp4";

      // Safe filename
      const safeName = title
        .replace(/[\\/:*?"<>|]/g, "")
        .substring(0, 50);

      const filePath = path.join(
        cacheDir,
        `${safeName}.${ext}`
      );

      // Save file
      fs.writeFileSync(filePath, fileRes.data);

      // React
      api.setMessageReaction("✅", messageID, () => {}, true);

      // Update loading
      await api.editMessage(
        `🎵 Processing Complete...\n\n${loadingFrames[4]}`,
        loading.messageID,
        threadID
      );

      // Send file
      await api.sendMessage(
        {
          body:
`🎶 Title: ${title}

📺 Channel: ${channel}
⏱ Duration: ${duration}
👁 Views: ${views}

🔗 ${url}

🖤 𝑶𝑾𝑵𝑬𝑹 ★™
𝐏𝐑𝐈𝐍𝐂𝐄 𝐌𝐄𝐆𝐇𝐖𝐀𝐍𝐒𝐈`,
          attachment: fs.createReadStream(filePath)
        },
        threadID,
        async () => {

          // Delete file
          try {
            await fs.unlink(filePath);
          } catch (e) {
            console.log("Delete Error:", e.message);
          }

          // Remove loading message
          api.unsendMessage(loading.messageID);
        },
        messageID
      );

    } catch (error) {

      console.log(error);

      api.setMessageReaction("❌", messageID, () => {}, true);

      api.unsendMessage(loading.messageID);

      return api.sendMessage(
        `❌ Error:\n${error.message}`,
        threadID,
        messageID
      );
    }
  }
};
