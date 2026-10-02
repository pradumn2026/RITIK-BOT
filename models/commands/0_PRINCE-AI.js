const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- CONFIGURATION ---
const GROQ_API_KEY = "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"; 

const HISTORY_FILE = path.join(__dirname, "temporary", "juhi_history.json");
const HISTORY_LIMIT = 10;
const MODEL_NAME = "llama-3.3-70b-versatile"; 

// --- UPDATED CHARACTER (Short & Sweet) ---
const SYSTEM_PROMPT = `Tumhara naam Janu hai.
Tum ek cute, naughty aur flirty girlfriend ki tarah baat karti ho.
Tumhe lambe answers dena pasand nahi hai, tum hamesha 1-2 line mein chota jawab deti ho.
Tum Hinglish use karti ho.
Tum gussa nahi karti, bas mazak aur masti karti ho.
Agar koi flirting kare to tum bhi flirt karo, par limit mein.
Over-react mat karna, normal insaan ki tarah baat karna.`;

// --- HELPER FUNCTIONS ---
function ensureHistoryFile() {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify({}), 'utf8');
}

function readHistory() {
  ensureHistoryFile();
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return {}; }
}

function writeHistory(data) {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8'); } catch (err) {}
}

function getUserHistory(userID) {
  const allHistory = readHistory();
  return Array.isArray(allHistory[userID]) ? allHistory[userID] : [];
}

function saveUserHistory(userID, newHistory) {
  const allHistory = readHistory();
  allHistory[userID] = newHistory.slice(-HISTORY_LIMIT);
  writeHistory(allHistory);
}

// --- API FUNCTION ---
async function getGroqReply(userID, prompt) {
  const history = getUserHistory(userID);
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: prompt }];

  try {
    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
      model: MODEL_NAME,
      messages: messages,
      temperature: 0.7,
      max_tokens: 200, // Tokens kam kar diye taki answer chota aaye
      top_p: 1,
      stream: false
    }, { headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" } });

    const botReply = response.data.choices[0].message.content;
    saveUserHistory(userID, [...history, { role: "user", content: prompt }, { role: "assistant", content: botReply }]);
    return botReply;

  } catch (error) {
    const msg = error.response ? error.response.data.error.message : error.message;
    throw new Error(msg);
  }
}

// --- MAIN COMMAND ---
module.exports = {
  config: {
    name: "juhi",
    aliases: ["chat", "ai"],
    description: "Chat with Juhi (Fixed Reply)",
    usage: "{prefix}juhi <message>",
    credit: "𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭",
    hasPrefix: false,
    permission: 0,
    cooldown: 5,
    category: 'AI'
  },

  run: async function({ api, message, args }) {
    const { threadID, messageID, senderID } = message;
    const prompt = args.join(" ").trim();

    if (!prompt) return api.sendMessage("Bolo babu? Kuch kahoge? 😘", threadID, messageID);

    api.setMessageReaction("💋", messageID, () => {}, true);

    try {
      const reply = await getGroqReply(senderID, prompt);
      
      api.sendMessage(reply, threadID, (err, info) => {
        if (err) return;

        // --- FIXED REPLY HANDLER (Based on your snippet) ---
        const repliesList = global.client.replies.get(threadID) || [];
        repliesList.push({
          command: module.exports.config.name,
          messageID: info.messageID,
          expectedSender: senderID,
          data: {}
        });
        global.client.replies.set(threadID, repliesList);
        
      }, messageID);

    } catch (error) {
      api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
    }
  },

  handleReply: async function({ api, message }) {
    // Check if valid reply
    if (!message.messageReply) return;

    const { threadID, messageID, senderID, body } = message;
    const prompt = body.trim();
    if (!prompt) return;

    // Check agar reply sahi user se hai
    const replies = global.client.replies.get(threadID) || [];
    const replyData = replies.find(r => r.messageID === message.messageReply.messageID);
    
    if (!replyData || replyData.expectedSender !== senderID) return;

    api.setMessageReaction("❤️", messageID, () => {}, true);

    try {
      const reply = await getGroqReply(senderID, prompt);

      api.sendMessage(reply, threadID, (err, info) => {
        if (err) return;

        // Chain continue rakhne ke liye naya reply register karo
        const updatedReplies = global.client.replies.get(threadID) || [];
        updatedReplies.push({
          command: module.exports.config.name,
          messageID: info.messageID,
          expectedSender: senderID,
          data: {}
        });
        global.client.replies.set(threadID, updatedReplies);

      }, messageID);

    } catch (error) {
      api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
    }
  }
};
