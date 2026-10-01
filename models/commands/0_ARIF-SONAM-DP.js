const fs = require("fs");
module.exports.config = {
  name: "SONAM-2",
    version: "1.0.1",
  hasPermssion: 0,
  credits: "FAIZ ANSARI", 
  description: "hihihihi",
  commandCategory: "no prefix",
  usages: "haniya",
    cooldowns: 5, 
};

module.exports.handleEvent = function({ api, event, client, __GLOBAL }) {
  var { threadID, messageID } = event;
  if (event.body.indexOf("@S M Singh")==0 || event.body.indexOf("@Sonam Singh")==0 || event.body.indexOf("Sm")==0 || event.body.indexOf("Sm singh")==0) {
    var msg = {
        body: "❤️𝐃𝐄𝐊𝐇𝐎 𝐌𝐄𝐑𝐈 𝐁𝐎𝐒𝐒 𝐒𝐎𝐍𝐀𝐌 𝐀𝐀 𝐆𝐀𝐘 🙈 😎 𓆩♡𓆪🙈",
        attachment: fs.createReadStream(__dirname + `/ARIF-BABU/sonam.mp4`)
      }
      api.sendMessage(msg, threadID, messageID);
    api.setMessageReaction("😎", event.messageID, (err) => {}, true)
    }
  }
  module.exports.run = function({ api, event, client, __GLOBAL }) {

  }
