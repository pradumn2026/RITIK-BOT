module.exports.config = {
  name: "ADMIN",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "ARIF BABU",
  description: "THIS BOT WAS MADE BY MR PRINCE MEGHWANSI",
  commandCategory: "ADMIN MENTION",
  usages: "",
  cooldowns: 1
};
module.exports.handleEvent = function({ api, event }) {
  if (event.senderID !== "100001280152322") {
];
    for (const id of aid) {
    if ( Object.keys(event.mentions) == id) {
      var msg = ["अरे यार मुझसे बात करो बॉस को क्यूं बुला रहे हो 🙄", "किया हुआ मेरे बॉस को क्यूं बुला रहे हो", "मेरे बॉस शायद बीजी है", "अरे यार क्यूं मेरे बॉस को तंग कर रहे हो", "मेरा बॉस अभी सो रहे होगे", "लगता है मेरा बॉस बाबू सोना करने में बीजी है 🤔", "किया काम है मुझे बताओ मैं बॉस को बता दूंगा", "मेरे बॉस शायद अभी ऑफ लाइन है" , "मेरे बॉस अभी बीजी है 😐✌️"];
      return api.sendMessage({body: msg[Math.floor(Math.random()*msg.length)]}, event.threadID, event.messageID);
    }
    }}
};
module.exports.run = async function({}) {
        }
