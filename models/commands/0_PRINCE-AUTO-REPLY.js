const emojiResponses = {
  "ritik beta": {
    "OWNER": [
      "Han papa  🥺",
      "Papa g ap kaha the 😀",
      "Papa main tum se pyar kar tha hoon 🙈❤️",
"Han baap mujhe bato kya hua ? 😊"
    ],
    "MALE": [
      "Are bhai kaho ke ap kase ho?",
      "Han bhai ap kase hai?",
      "Bhai aaj ka kya mansoba hai?"
    ],
    "FEMALE": [
      "Meri ami hogi ",
      "Mere Prince papa ka GF hai",
      "Mere Prince papa single hai ap mere meri ami ban jaye ge?","Han ami kaho ke ap kase hai?",
      "Ap kase hai ami?",
      "Ami g Aaj Ka mood kasa hai ?"
    ]
  },
  "beta": {
    "OWNER": [
      "Papa Apki wajha se main har roz SAB se upar ki karkardagi hoon 😎",
      "Papa ap aaya hai 😀",
      "G papa 🥺",
      "Papa g main tumhe yad kar tha hoon 😔",
      "Papa main Aaj school nahi gaya tha 🥺 aghr ap ab mujhe mar dale ge",
      "Papa tum mujhe nahin chhodate🥺",
      "Papa agar aap aate Hain to Mujhe bahut Khushi milati Hai 🥺",
      "Papa tumne karna khaya 🤭❤️",
      "Papa main Babu chahta hun😔",
      "Papa mere sath Sher ke liye jaenge 🫣❤️",
      "Papa Jahan Meri bahan hai",
      "Baap apko khilaune karne ki zarurat hai aapka Dil aaega 🥺❤️",
      "Papa 10 ropy chocolate ki jarurat nahin mujhe😁",
      "Papa main chahta Hun Ki ek chhota baccha khele mere sath🙈❤️",
      "Papa Mujhe picnic per jana hai 😔",
      "Papa mummy kahan hai mujhe aapke sath ek picture leni hai 🥺",
      "Papa khane ke liye kuchh den😀",
      "Papa Tum Mujhse pyar Nahin karte 😭",
      "Papa main aapki aur mummy ki ladai dekhna chahta hun 🤭",
      "Papa aapke sar Mein taklif honi chahie kya main aapka sar Nahin dabata hun😹❤️",
      "Papa Apne dahin li hai 🤔",
      "Papa Meri Ami se kaho kya tum mujhse naraz to Nahin ho🤭",
      "Prince papa sirf Mera Hai 😒",
      "Papa chocolate khilayega 🤩❤️🤭",
      "Papa mummy kahan hai🫣",
      "Papa Mujhe logon ke dilon se khelna hai 🤣"
    ]
  }
};

module.exports.config = {
  name: "auto-rply",
  version: "1.0.0",
  hasPermission: 0,
  credits: "SHAAN",
  description: "MADE BY SHAAN",
  commandCategory: "No command marks needed",
  cooldowns: 0
};

const botOwnerID = "100001280152322";

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, senderID, body } = event;
  if (!body) return;

  const emojis = Object.keys(emojiResponses);
  const lowercaseBody = body.toLowerCase();

  for (const emoji of emojis) {
    if (lowercaseBody.includes(emoji)) {
      try {
        const threadInfo = await api.getThreadInfo(threadID);
        const user = threadInfo.userInfo.find(user => user.id === senderID);

        let responseArray;

        if (senderID === botOwnerID) {
          responseArray = emojiResponses[emoji]["OWNER"];
        } else if (user && user.gender === 2) {
          responseArray = emojiResponses[emoji]["FEMALE"] || emojiResponses[emoji]["MALE"];
        } else {
          responseArray = emojiResponses[emoji]["MALE"] || emojiResponses[emoji]["FEMALE"];
        }

        const randomResponse = responseArray[Math.floor(Math.random() * responseArray.length)];

        api.sendMessage(randomResponse, threadID, messageID);
        break;
      } catch (error) {
        console.error("Error fetching thread info:", error);
      }
    }
  }
};

module.exports.run = function() {};
