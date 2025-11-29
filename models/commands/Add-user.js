const { formatMessage } = require('../../utils/formatter');
const axios = require('axios');

module.exports.config = {
  name: 'adduser',
  version: '1.0.2',
  hasPermssion: 2,
  credits: 'SARDAR RDX (modified)',
  description: "Add a user to the group by UID or Facebook link",
  commandCategory: "Admin",
  usages: "adduser <uid | profile_link>",
  cooldowns: 5
};

function extractUidFromLink(link) {
  // Try common patterns: profile.php?id=12345 or URLs that end with numeric id
  try {
    if (!link) return null;
    // profile.php?id=123456
    const idMatch = link.match(/profile\.php\?id=(\d+)/i);
    if (idMatch) return idMatch[1];

    // facebook.com/10000... (sometimes numeric at end)
    const digitsEnd = link.match(/facebook\.com\/.*?(\d{5,})\/?$/i);
    if (digitsEnd) return digitsEnd[1];

    // If it's a plain numeric string
    if (/^\d+$/.test(link)) return link;

    // As a fallback, try to extract username (non-numeric)
    const usernameMatch = link.match(/facebook\.com\/([^/?&]+)/i);
    if (usernameMatch) return usernameMatch[1];

    return null;
  } catch (e) {
    return null;
  }
}

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // permission check: only bot admins (match your rdxhere style)
  if (!global.config.ADMINBOT || !global.config.ADMINBOT.includes(senderID)) {
    return api.sendMessage(formatMessage("❌ Only bot admins can use this command!"), threadID, messageID);
  }

  if (!args[0]) {
    return api.sendMessage(formatMessage("❌ Please enter the UID or profile link to add.\nUsage: adduser <uid|profile_link>"), threadID, messageID);
  }

  try {
    // get thread info (participants, approvalMode, adminIDs)
    const threadInfo = await api.getThreadInfo(threadID);
    const { participantIDs = [], approvalMode = false, adminIDs = [] } = threadInfo;

    const raw = args.join(' ').trim();
    let uid = extractUidFromLink(raw);

    // If we only got a username (non-numeric) and your api cannot resolve usernames,
    // inform the user to supply numeric id or a link with profile.php?id=
    if (!uid) {
      return api.sendMessage(formatMessage("❌ Could not extract UID from that input. Please supply a numeric UID or a full profile link (e.g. profile.php?id=123456)."), threadID, messageID);
    }

    // If uid looks like a username (contains letters) let bot try, but warn user
    if (!/^\d+$/.test(uid)) {
      await api.sendMessage(formatMessage("ℹ️ Detected a username instead of numeric UID. Bot will attempt to add using that identifier, but if it fails, try providing numeric UID."), threadID, messageID);
    }

    // Prevent trying to add someone already inside
    if (participantIDs.includes(uid) || participantIDs.includes(Number(uid))) {
      return api.sendMessage(formatMessage("ℹ️ The member is already in the group."), threadID, messageID);
    }

    // Attempt to add
    try {
      await api.addUserToGroup(uid, threadID);
      // If approval mode is ON and bot isn't admin, the API may not add directly but queue for approval.
      if (approvalMode && !adminIDs.some(item => item.id == api.getCurrentUserID())) {
        return api.sendMessage(formatMessage("✅ Request sent — user added to the approval list (group requires admin approval)."), threadID, messageID);
      }
      return api.sendMessage(formatMessage(`✅ Successfully added user: ${uid}`), threadID, messageID);
    } catch (addErr) {
      console.log("addUserToGroup error:", addErr && addErr.message ? addErr.message : addErr);
      // Try converting to Number if it was string numeric
      if (/^\d+$/.test(uid)) {
        try {
          await api.addUserToGroup(Number(uid), threadID);
          return api.sendMessage(formatMessage(`✅ Successfully added user (after numeric conversion): ${uid}`), threadID, messageID);
        } catch (err2) {
          console.log("retry with Number failed:", err2 && err2.message ? err2.message : err2);
        }
      }
      // final fallback message
      return api.sendMessage(formatMessage("❌ Can't add the member to the group. Possible reasons:\n• Bot is not group admin\n• The UID/username is invalid\n• Group requires approval and bot isn't admin\n\nTry giving a numeric UID (profile.php?id=123456) or make bot an admin and retry."), threadID, messageID);
    }

  } catch (err) {
    console.error("adduser command error:", err && err.message ? err.message : err);
    return api.sendMessage(formatMessage(`❌ Error: ${err && err.message ? err.message : 'Unknown error'}`), threadID, messageID);
  }
};
