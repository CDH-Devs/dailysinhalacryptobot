// =================================================================
// === trading-logic.js (UPDATED: TRADING VALIDATION REMOVED) ===
// =================================================================

// --- 0. CONFIGURATION (Keys සහ IDs සෘජුවම කේතයේ) ---
// ⚠️ ඔබගේ සැබෑ අගයන් සමඟ යාවත්කාලීන කරන්න ⚠️

const CONFIG = {
    // 🛑 ඔබේ Bot Token එක
    TELEGRAM_BOT_TOKEN: "5100305269:AAEHxCE1z9jCFZl4b0-yoRfVfojKBRKSL0Q", 
    
    // 🛑 ඔබේ Channel/Group Chat ID එක (Lifetime Post එක යැවිය යුතු ස්ථානය)
    TELEGRAM_CHAT_ID: "-1002947156921", // ඔබ ලබා දුන් Channel ID එක
    
    // 🛑 ඔබේ පුද්ගලික Chat ID එක (Owner ගේ Private ID එක - String ලෙස තබන්න)
    OWNER_CHAT_ID: "1901997764", // ඔබේ Owner ID එක මෙය නොවේ නම් වෙනස් කරන්න
    
    // 🛑 ඔබේ අලුත්ම Gemini API Key එක
    GEMINI_API_KEY: "AIzaSyDXf3cIysV1nsyX4vuNrBrhi2WCxV44pwA", 
    
    // Telegram API Endpoint Base URL එක (Token එකෙන් සෑදී ඇත)
    TELEGRAM_API_BASE: `https://api.telegram.org/bot5100305269:AAEHxCE1z9jCFZl4b0-yoRfVfojKBRKSL0Q`,
    
    // දිනකට උපරිම අවසර ලත් භාවිතය
    DAILY_LIMIT: 5
};

// --- 1. CORE AI FUNCTIONS ---

async function generateScheduledContent(env) { 
    const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY; 
    const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // 1. KV එකෙන් කලින් Post කළ Topics ලැයිස්තුව ලබා ගැනීම.
    const coveredTopicsString = await env.POST_STATUS_KV.get('COVERED_TOPICS') || "[]";
    let coveredTopics = JSON.parse(coveredTopicsString);
    
    // 2. දැනටමත් Post කර ඇති topics.
    const excludedTopicsString = coveredTopics.join(', ');
    
    const systemPrompt = `
        You are an expert financial and trading educator. Your primary goal is to provide daily, **step-by-step** foundational trading education for absolute beginners.
        The topics covered so far and MUST BE AVOIDED are: [${excludedTopicsString}].
        
        Your task is to:
        1. **Systematic Topic Selection:** Use the 'google_search' tool to select a fundamental trading topic from the beginner's curriculum. Topics MUST include core elements like: **Candlesticks, Support and Resistance, Money Management, Chart Patterns, Fibonacci Tools, and basic Indicators (RSI, Moving Averages)**.
        2. **Content Generation:** Generate a high-quality, 5-paragraph educational post using **clear SINHALA language (සිංහල අක්ෂර / Unicode)** mixed with necessary English trading terms.
        3. The post must be well-formatted using Telegram's **Markdown**. The first line must be a clear title indicating the topic.
        
        Your final output must contain ONLY the content of the post.
    `;
    const userQuery = "Generate today's new, progressive, and engaging Sinhala educational trading post for beginners.";

    try {
        const response = await fetch(GEMINI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }], 
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { temperature: 0.8 } 
            }),
        });
        
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
        
        if (content) {
            // 3. Topic එක අලුතින් Post කළ Topics ලැයිස්තුවට එකතු කිරීම
            const newTopicMatch = content.match(/\*([^*]+)\*/); // පළමු බෝල්ඩ් කර ඇති මාතෘකාව ලබා ගනී
            const newTopic = newTopicMatch ? newTopicMatch[1].trim() : "Untitled Post";
            
            coveredTopics.push(newTopic);
            
            // KV එක යාවත්කාලීන කරන්න (Topic ලැයිස්තුව)
            await env.POST_STATUS_KV.put('COVERED_TOPICS', JSON.stringify(coveredTopics));
            
            // අද Post කළ මාතෘකාව ද ගබඩා කරන්න
            await env.POST_STATUS_KV.put('LAST_TRADING_TOPIC', newTopic);
            
            return content;
        }

        return null;
        
    } catch (e) {
        return null;
    }
}

async function generateReplyContent(userQuestion) {
    const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    // System Prompt එක දැන් පොදු ප්‍රශ්නවලට පිළිතුරු දීමට සකසා ඇත.
    const systemPrompt = `
        You are a detailed, expert general assistant who can provide comprehensive answers on any topic. A user has asked you a question.
        
        Your task is to:
        1. Use the 'google_search' tool to get the most accurate and educational information for the user's question.
        2. Generate a **DETAILED, EDUCATIONAL RESPONSE**. The response should be well-structured, ideally covering the concept fully.
        3. Use **clear SINHALA language (සිංහල අක්ෂර / Unicode)**. If the topic is technical (like trading), use necessary English terms where appropriate.
        4. The response must be well-formatted using Telegram's **Markdown** (bolding key terms, using lists, and emojis).
        5. The first line of the response MUST be a clear title based on the user's question.

        Your final output must contain ONLY the content of the response.
    `;
    
    try {
        const response = await fetch(GEMINI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: userQuestion }] }],
                tools: [{ "google_search": {} }], 
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { temperature: 0.7 } 
            }),
        });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "මට එම ප්‍රශ්නයට පිළිතුරු දීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න. (Content Missing)";
    } catch (e) {
        return "මට එම ප්‍රශ්නයට පිළිතුරු දීමට නොහැකි විය. (Exception)";
    }
}

// ⚠️ PREVIOUS validateTopic FUNCTION IS NOW REMOVED/COMMENTED OUT ⚠️


// --- 2. CORE TELEGRAM FUNCTIONS ---

async function sendTypingAction(chatId) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/sendChatAction`;
    try {
        await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId, 
                action: 'typing' 
            }),
        });
        return true;
    } catch (e) {
        return false;
    }
}

// Owner වෙත Message යැවීම සඳහා
async function sendTelegramReplyToOwner(text, keyboard = null) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/sendMessage`;
    try {
        const ownerChatIdString = CONFIG.OWNER_CHAT_ID.toString();
        
        const body = {
            chat_id: ownerChatIdString, 
            text: text,
            parse_mode: 'Markdown' 
        };
        if (keyboard) {
            body.reply_markup = { inline_keyboard: keyboard };
        }
        
        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        
        if (!data.ok) {
            console.error("TELEGRAM SEND ERROR (Owner Final Check):", JSON.stringify(data));
        }
        
        return data.ok; 
    } catch (e) {
        console.error("TELEGRAM FETCH ERROR (Owner Final Check):", e);
        return false;
    }
}

async function sendTelegramMessage(caption) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/sendMessage`;
    try {
        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.TELEGRAM_CHAT_ID, 
                text: caption,
                parse_mode: 'Markdown' 
            }),
        });
        
        return response.ok;
    } catch (e) {
        return false;
    }
}

// --- New Function: Facebook/Instagram Post ---
async function sendFacebookPost(env, caption) {
    // 🔑 Secrets env object එකෙන් ලබා ගනී
    const FACEBOOK_PAGE_ID = env.FACEBOOK_PAGE_ID;
    const FACEBOOK_ACCESS_TOKEN = env.FACEBOOK_ACCESS_TOKEN;
    
    if (!FACEBOOK_PAGE_ID || !FACEBOOK_ACCESS_TOKEN) {
        // Secrets නැතිනම් Owner ට දැනුම් දී false return කරන්න
        const missingSecret = !FACEBOOK_PAGE_ID ? "FACEBOOK_PAGE_ID" : "FACEBOOK_ACCESS_TOKEN";
        await sendTelegramReplyToOwner(`⚠️ *Facebook Secrets Missing:* \`${missingSecret}\` Cloudflare Secrets වල සකසා නැත. Facebook Post එක යැවීම අසාර්ථකයි.`, null);
        console.error("Facebook Secrets (PAGE_ID or ACCESS_TOKEN) are not set in Cloudflare env.");
        return false;
    }

    // Graph API Endpoint එක (Page ID එක හරහා)
    const API_ENDPOINT = `https://graph.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/feed`;

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: caption, 
                access_token: FACEBOOK_ACCESS_TOKEN,
            }),
        });

        const data = await response.json();
        
        if (data.id) {
            console.log("Facebook/Instagram Post Successful. Post ID:", data.id);
            return true;
        } else {
            console.error("Facebook/Instagram Post Failed:", data);
            await sendTelegramReplyToOwner(`❌ *Facebook Post Failed:* \n\nFacebook API Error: \`${JSON.stringify(data.error)}\``, null);
            return false;
        }
    } catch (e) {
        console.error("Error posting to Facebook:", e);
        await sendTelegramReplyToOwner(`❌ *Facebook Post Failed (Network Error):* ${e.message}`, null);
        return false;
    }
}
// --- End of New Function ---


async function sendTelegramReply(chatId, text, messageId) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/sendMessage`;
    try {
        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId, 
                text: text,
                parse_mode: 'Markdown',
                reply_to_message_id: messageId 
            }),
        });
        
        const data = await response.json();
        return data.ok ? data.result.message_id : null; 
    } catch (e) {
        return null;
    }
}

// Buttons ඉවත් නොකර, Text පමණක් Edit කරන function එක
async function editTelegramMessage(chatId, messageId, text) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/editMessageText`;
    try {
        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId, 
                message_id: messageId, 
                text: text,
                parse_mode: 'Markdown'
            }),
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function editTelegramMessageWithKeyboard(chatId, messageId, text, keyboard) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/editMessageText`;
    try {
        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId, 
                message_id: messageId, 
                text: text,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            }),
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function answerCallbackQuery(callbackQueryId, text, showAlert) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/answerCallbackQuery`;
    try {
        await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId, 
                text: text,
                show_alert: showAlert 
            }),
        });
        return true;
    } catch (e) {
        return false;
    }
}

// Buttons පමණක් ඉවත් කිරීම සඳහා නව function එක
async function removeInlineKeyboard(chatId, messageId) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/editMessageReplyMarkup`;
    try {
        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId, 
                message_id: messageId, 
                reply_markup: {} // හිස් reply_markup යවයි
            }),
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function sendPhotoWithCaption(chatId, photoUrl, caption, keyboard) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/sendPhoto`;
    try {
        const body = {
            chat_id: chatId, 
            photo: photoUrl,
            caption: caption,
            parse_mode: 'Markdown'
        };

        if (keyboard) {
            body.reply_markup = { inline_keyboard: keyboard };
        }

        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        
        const data = await response.json();
        return data.ok ? { success: true, messageId: data.result.message_id } : { success: false, error: data };
    } catch (e) {
        return { success: false, error: e.toString() };
    }
}

async function editPhotoCaption(chatId, messageId, caption) {
    const TELEGRAM_API_ENDPOINT = `${CONFIG.TELEGRAM_API_BASE}/editMessageCaption`;
    try {
        const response = await fetch(TELEGRAM_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId, 
                message_id: messageId, 
                caption: caption,
                parse_mode: 'Markdown'
            }),
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}


// --- 3. HELPER FUNCTIONS ---

// Markdown Escape Function
function escapeMarkdown(text) {
    if (!text) return "";
    return text.replace(/([_*`])/g, '\\$1');
}

// Helper function to generate a short, random ID (for KV Key)
function generateRandomId(length = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

async function checkAndIncrementUsage(env, chatId) {
    if (chatId.toString() === CONFIG.OWNER_CHAT_ID.toString()) {
        return { allowed: true, count: 'Unlimited' };
    }

    const today = new Date().toISOString().slice(0, 10);
    const KV_KEY = `usage:${today}:${chatId}`;

    const currentUsageStr = await env.POST_STATUS_KV.get(KV_KEY);
    let currentUsage = parseInt(currentUsageStr) || 0;

    if (currentUsage >= CONFIG.DAILY_LIMIT) {
        return { allowed: false, count: currentUsage, kvKey: KV_KEY }; 
    }

    currentUsage += 1;
    
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0); 
    const expirationTtl = Math.max(1, Math.ceil((endOfDay.getTime() - now.getTime()) / 1000)); 
    
    await env.POST_STATUS_KV.put(KV_KEY, currentUsage.toString(), { expirationTtl: expirationTtl });

    return { allowed: true, count: currentUsage, kvKey: KV_KEY };
}

async function updateAndEditUserCount(env, userId) {
    const USER_SET_KEY = 'BOT_USER_SET'; 
    const COUNT_POST_ID_KEY = 'COUNT_POST_ID'; 
    const DAILY_COUNT_KEY = 'DAILY_USER_COUNT'; 

    const userIdString = userId.toString();

    const userSet = await env.POST_STATUS_KV.get(USER_SET_KEY, 'json') || [];
    const isNewUser = !userSet.includes(userIdString);
    
    if (isNewUser) {
        userSet.push(userIdString);
        await env.POST_STATUS_KV.put(USER_SET_KEY, JSON.stringify(userSet));
        const totalCount = userSet.length;
        
        const dailyCountStr = await env.POST_STATUS_KV.get(DAILY_COUNT_KEY) || '0';
        let dailyCount = parseInt(dailyCountStr);
        dailyCount += 1;
        
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0); 
        const expirationTtl = Math.max(1, Math.ceil((endOfDay.getTime() - now.getTime()) / 1000)); 
        await env.POST_STATUS_KV.put(DAILY_COUNT_KEY, dailyCount.toString(), { expirationTtl: expirationTtl });
        
        const postDetailsStr = await env.POST_STATUS_KV.get(COUNT_POST_ID_KEY);
        
        if (postDetailsStr) {
            const [chatId, messageId] = postDetailsStr.split(':');
            
            const timeZone = 'Asia/Colombo';
            const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const newCaption = `*⭐ Bot Statistics Update 📈*
            
දැනට මෙම Bot එක භාවිතා කරන සම්පූර්ණ පරිශීලකයින් ගණන:
            
*▶️ Total Users:* **${totalCount.toLocaleString()}**
*🔥 Daily Growth:* **+${dailyCount.toLocaleString()} new users**
*⏰ Last Updated:* ${currentTime} (SL Time)

---
            
*🌐 Join the Community:* [Mrchamo Official Channel](https://t.me/Mrchamo_Lk)
*Use /start to register.*`;

            await editPhotoCaption(chatId, parseInt(messageId), newCaption);
            
            return { success: true, newCount: totalCount };
        }
    }

    return { success: isNewUser, newCount: userSet.length };
}


// --- 4. COMMANDS FOR OWNER ---

async function sendInitialCountPost(env, ownerChatId) {
    const PHOTO_URL = "https://envs.sh/7R4.jpg"; // Placeholder URL
    const COUNT_POST_ID_KEY = 'COUNT_POST_ID';
    
    // Channel ID එක ලබා ගැනීම (CONFIG එකෙන්)
    const targetChatId = CONFIG.TELEGRAM_CHAT_ID;

    const existingPost = await env.POST_STATUS_KV.get(COUNT_POST_ID_KEY);
    if (existingPost) {
        return { success: false, message: `Permanent Count Post එක දැනටමත් පවතී. Post ID: ${existingPost}` };
    }

    const userSet = await env.POST_STATUS_KV.get('BOT_USER_SET', 'json') || [];
    const dailyCountStr = await env.POST_STATUS_KV.get('DAILY_USER_COUNT') || '0';
    const totalCount = userSet.length;
    
    const timeZone = 'Asia/Colombo';
    const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const initialCaption = `*⭐ Bot Statistics Update 📈*
            
දැනට මෙම Bot එක භාවිතා කරන සම්පූර්ණ පරිශීලකයින් ගණන:
            
*▶️ Total Users:* **${totalCount.toLocaleString()}**
*🔥 Daily Growth:* **+${dailyCountStr} new users**
*⏰ Last Updated:* ${currentTime} (SL Time)

---
            
*🌐 Join the Community:* [Mrchamo Official Channel](https://t.me/Mrchamo_Lk)
*Use /start to register.*`;

    const keyboard = [
        [{ text: "Click for Private Info", callback_data: 'SHOW_PRIVATE_INFO' }]
    ];

    // FIX: Post එක Channel ID එකට යැවීම
    const result = await sendPhotoWithCaption(targetChatId, PHOTO_URL, initialCaption, keyboard);
    
    if (result.success) {
        const postIdentifier = `${targetChatId}:${result.messageId}`;
        await env.POST_STATUS_KV.put(COUNT_POST_ID_KEY, postIdentifier);
        return { success: true, message: `Permanent Count Post එක සාර්ථකව \`${targetChatId}\` Chat ID එකට යවා ගබඩා කරන ලදී. Post ID: ${postIdentifier}` };
    } else {
        return { success: false, message: `Post යැවීම අසාර්ථක විය: ${JSON.stringify(result.error)}` };
    }
}


// --- 5. WORKER ENTRY POINT (Handles Webhook) ---

async function handleWebhook(request, env) {
    try {
        const update = await request.json();
        
        if (update && update.callback_query) {
            return handleCallbackQuery(update.callback_query, env);
        }

        if (update && update.message && update.message.text) {
            const message = update.message;
            const chatId = message.chat.id;
            const messageId = message.message_id;
            const text = message.text.trim();
            const userId = message.from.id; 
            
            const userFirstName = message.from.first_name || "N/A";
            const userName = message.from.username ? `@${message.from.username}` : "N/A";


            // --- Owner Command: Send Initial Count Post ---
            if (chatId.toString() === CONFIG.OWNER_CHAT_ID.toString() && text.startsWith('/send_count_post')) {
                const result = await sendInitialCountPost(env, chatId); 
                await sendTelegramReply(chatId, result.message, messageId);
                return new Response('Count post command processed', { status: 200 });
            }

            // --- Owner Command: Post to Facebook Manually ---
            if (chatId.toString() === CONFIG.OWNER_CHAT_ID.toString() && text.startsWith('/post_facebook_manual')) {
                
                const initialMessageId = await sendTelegramReply(chatId, "⏳ *Facebook Post එක සඳහා Content Generate කරමින්...*", messageId);
                
                if (!initialMessageId) {
                    console.error("Failed to send initial Telegram reply for /post_facebook_manual command.");
                    return new Response('Failed to send initial Telegram reply', { status: 200 });
                }
                
                // Content Generation
                const postContent = await generateScheduledContent(env); 
                
                if (postContent) {
                    await editTelegramMessage(chatId, initialMessageId, "🌐 *Content Generation සාර්ථකයි. Facebook වෙත යවමින්...*");
                    
                    // Facebook Post
                    const fbSuccess = await sendFacebookPost(env, postContent);
                    
                    if (fbSuccess) {
                        await editTelegramMessage(chatId, initialMessageId, "✅ *Facebook Post සාර්ථකයි!* \n\nඔබගේ Content එක Facebook වෙත යවන ලදී.");
                    } else {
                        await editTelegramMessage(chatId, initialMessageId, "❌ *Facebook Post අසාර්ථකයි!* \n\n(විස්තර Owner ගේ Private Chat එකේ බලන්න - Secrets පරීක්ෂා කරන්න).");
                    }
                } else {
                    await editTelegramMessage(chatId, initialMessageId, "❌ *Content Generation අසාර්ථකයි.* \n\n(Check logs - GEMINI_API_KEY නිවැරදිද බලන්න).");
                }
                
                return new Response('Manual Facebook Post command processed', { status: 200 });
            }


            // --- ADMIN COMMANDS (Owner Only) ---
            if (chatId.toString() === CONFIG.OWNER_CHAT_ID.toString() && text.startsWith('/unlimit')) {
                const parts = text.split(' ');
                if (parts.length === 2) {
                    const targetChatId = parts[1].trim();
                    const today = new Date().toISOString().slice(0, 10);
                    const KV_KEY = `usage:${today}:${targetChatId}`;
                    
                    await env.POST_STATUS_KV.delete(KV_KEY);
                    
                    const successMessage = `✅ *User Limit Removed!* \n\nUser ID: \`${targetChatId}\` ගේ දෛනික සීමාව (limit) අද දින සඳහා සාර්ථකව ඉවත් කරන ලදී.`;
                    await sendTelegramReply(chatId, successMessage, messageId);
                    return new Response('Admin command processed', { status: 200 });
                } else {
                    await sendTelegramReply(chatId, "⚠️ *Usage:* /unlimit [User_Chat_ID_Eka]", messageId);
                    return new Response('Admin command error', { status: 200 });
                }
            }


            // --- REGULAR COMMANDS (/start, /help) ---
            if (text.startsWith('/')) {
                const command = text.split(' ')[0].toLowerCase();
                
                if (command === '/start') {
                    await updateAndEditUserCount(env, userId);
                    
                    // Welcome Message එක General Q&A වලට ගැළපෙන ලෙස වෙනස් කර ඇත.
                    const welcomeMessage = "👋 *Welcome to the General Assistant Bot!* \n\nමම ඔබ අසන ඕනෑම ප්‍රශ්නයකට පිළිතුරු දීමට සූදානම්. \n\n*Limit:* දවසකට **Questions 5** කට පමණයි. (Owner ට අසීමිතයි). \n\nඋත්සාහ කරන්න: 'මහින්ද්‍ර රාජපක්ෂ ගැන විස්තර දෙන්න' වැනි ඕනෑම ප්‍රශ්නයක් අසන්න.";
                    await sendTelegramReply(chatId, welcomeMessage, messageId);

                } else if (command === '/help') {
                    const helpMessage = "👋 *General Assistant Bot Help* \n\nමම ඔබ අසන ඕනෑම ප්‍රශ්නයකට පිළිතුරු දීමට සූදානම්. \n\n*Limit:* දවසකට **Questions 5** කට පමණයි. (Owner ට අසීමිතයි).";
                    await sendTelegramReply(chatId, helpMessage, messageId);
                }
                return new Response('Command processed', { status: 200 });
            }

            // --- ALL QUESTION ANSWERING LOGIC (Guardrail Removed) ---
            
            // 1. 🛑 Rate Limit Check (දැන් ඕනෑම ප්‍රශ්නයකට Limit එක බලපායි)
            const validationMessageId = await sendTelegramReply(chatId, "⏳ *ඔබගේ ප්‍රශ්නය සැකසෙමින් පවතී...*", messageId);
            
            if (!validationMessageId) {
                 return new Response('Failed initial reply', { status: 200 });
            }

            const usageResult = await checkAndIncrementUsage(env, chatId);
            
            if (!usageResult.allowed) {
                // Rate Limit ඉක්මවා ඇත්නම්
                const limitMessage = `🛑 *Usage Limit Reached!* \n\nSorry, oyage **Questions 5** (limit eka) ada dawasata iwarai. \n\n*Reset wenawa:* Midnight 12.00 AM walata. \n\n*Owner ge Approval one nam, Request karanna!*`;
                
                // KV එකේ User Request තොරතුරු ගබඩා කිරීම
                const requestId = `REQ_${generateRandomId()}`;
                const requestData = {
                    userChatId: chatId,
                    userMessageId: validationMessageId, 
                    targetUserId: userId,
                    userFirstName: userFirstName,
                    userName: userName
                };
                // Request එක පැය 24ක් සඳහා ගබඩා කිරීම
                await env.POST_STATUS_KV.put(`UNLIMIT_REQUEST_${requestId}`, JSON.stringify(requestData), { expirationTtl: 86400 });

                // Button එකට යවන්නේ KV Key එක පමණයි
                const keyboard = [
                    [{ text: "👑 Request Owner Approval", callback_data: `REQUEST_UNLIMIT_${requestId}` }]
                ];
                
                await editTelegramMessageWithKeyboard(chatId, validationMessageId, limitMessage, keyboard);
                return new Response('Rate limited with inline request button', { status: 200 });
            }
            
            // 2. 🌐 Searching Status 
            await editTelegramMessage(chatId, validationMessageId, "🌐 *Web එක Search කරමින්...* (Finding up-to-date info)");
            
            // 3. 🧠 Generation Status 
            await sendTypingAction(chatId); 
            await editTelegramMessage(chatId, validationMessageId, "✍️ *විස්තරාත්මක පිළිතුරක් සකස් කරමින්...* (Generating detailed reply)");
            
            // 4. 🔗 Final Content Generation
            const replyText = await generateReplyContent(text);
            
            // 5. ✅ Final Edit - සම්පූර්ණ පිළිතුර Message එකට යැවීම
            await editTelegramMessage(chatId, validationMessageId, replyText);
            
        }
    } catch (e) {
        console.error("Error processing webhook:", e);
    }
    
    return new Response('OK', { status: 200 });
}


// --- 6. Callback Query Handler (Owner Message Edit Logic) ---
async function handleCallbackQuery(query, env) {
    const data = query.data;
    const callbackQueryId = query.id;
    const userId = query.from.id;

    // 1. 🛑 UNLIMIT REQUEST LOGIC 
    if (data.startsWith('REQUEST_UNLIMIT_')) {
        const requestId = data.substring('REQUEST_UNLIMIT_'.length);
        const requestDataStr = await env.POST_STATUS_KV.get(`UNLIMIT_REQUEST_${requestId}`);
        
        if (!requestDataStr) {
            await answerCallbackQuery(callbackQueryId, "⚠️ මෙම ඉල්ලීම කල් ඉකුත් වී ඇත. නැවත උත්සාහ කරන්න.", true);
            return new Response('Expired request', { status: 200 });
        }
        
        const requestData = JSON.parse(requestDataStr);
        const { userChatId, userMessageId, targetUserId, userFirstName, userName } = requestData;

        // Markdown Escape
        const safeUserFirstName = escapeMarkdown(userFirstName);
        const safeUserName = escapeMarkdown(userName);
        
        await answerCallbackQuery(callbackQueryId, "✅ Owner වෙත ඔබගේ Limit ඉල්ලීම යවන ලදී. කරුණාකර පිළිතුරක් ලැබෙන තෙක් රැඳී සිටින්න.", true);
        
        const requestMessage = `*👑 UNLIMIT REQUEST* \n
*User Name:* ${safeUserFirstName} (${safeUserName})
*User ID:* \`${targetUserId}\`
*User Chat ID:* \`${userChatId}\`
*Original Message ID:* \`${userMessageId}\`
\n\nමෙම User ගේ අද දින Limit එක ඉවත් කර, ඔහුට සාර්ථක ලෙස දැනුම් දීමට පහත Button භාවිතා කරන්න.`;

        const approvalKeyboard = [
            [{ text: "✅ Approve Request", callback_data: `APPROVE_UNLIMIT_${requestId}` }],
            [{ text: "❌ Reject Request", callback_data: `REJECT_UNLIMIT_${requestId}` }]
        ];
        
        const sentToOwner = await sendTelegramReplyToOwner(requestMessage, approvalKeyboard);
        
        if (!sentToOwner) {
             console.error(`Failed to send unlimit request for user ${targetUserId} to owner.`);
        }
        
        return new Response('Unlimit request sent to owner', { status: 200 });
        
    } 
    
    // 2. 👑 APPROVAL / REJECTION LOGIC
    else if (data.startsWith('APPROVE_UNLIMIT_') || data.startsWith('REJECT_UNLIMIT_')) {
        
        if (userId.toString() !== CONFIG.OWNER_CHAT_ID.toString()) {
            await answerCallbackQuery(callbackQueryId, "🛑 ඔබට මෙය Approve කිරීමට බලය නැත. (Owner Only)", true);
            return new Response('Unauthorized approval attempt', { status: 200 });
        }
        
        const isApproved = data.startsWith('APPROVE');
        const requestId = data.substring(data.startsWith('APPROVE') ? 'APPROVE_UNLIMIT_'.length : 'REJECT_UNLIMIT_'.length);
        
        const requestDataStr = await env.POST_STATUS_KV.get(`UNLIMIT_REQUEST_${requestId}`);
        
        if (!requestDataStr) {
            await answerCallbackQuery(callbackQueryId, "⚠️ මෙම ඉල්ලීම කල් ඉකුත් වී ඇත. User ට සෘජුවම දැනුම් දෙන්න.", true);
            return new Response('Expired approval key', { status: 200 });
        }
        
        const requestData = JSON.parse(requestDataStr);
        const { userChatId, userMessageId, targetUserId, userFirstName } = requestData;
        
        // KV එකෙන් Key එක මැකීම
        await env.POST_STATUS_KV.delete(`UNLIMIT_REQUEST_${requestId}`);

        const userChatIdInt = parseInt(userChatId);
        const userMessageIdInt = parseInt(userMessageId);
        
        const today = new Date().toISOString().slice(0, 10);
        const KV_KEY = `usage:${today}:${userChatId}`;
        
        const ownerChatId = query.message.chat.id;
        const ownerMessageId = query.message.message_id;
        
        // Approval Message එකේ මුල් කොටස
        let newOwnerMessage = query.message.text.split('මෙම User ගේ')[0]; 
        
        // Sri Lanka Time ලබා ගැනීම
        const timeZone = 'Asia/Colombo';
        const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        
        if (isApproved) {
            // 2.1. KV එකෙන් Limit එක ඉවත් කිරීම
            await env.POST_STATUS_KV.delete(KV_KEY);
            
            // 2.2. User ගේ Original Message එක Edit කිරීම
            const successText = `✅ *Request Approved!* \n\n**Owner විසින් ඔබගේ Limit ඉල්ලීම අනුමත කරන ලදී!** \n\nදැන් ඔබට නැවත Bot භාවිතා කළ හැකිය. (Limit එක Reset වී ඇත.)`;
            const userEditSuccess = await editTelegramMessage(userChatIdInt, userMessageIdInt, successText);
            
            // 2.3. Owner ගේ Approval Message එක Edit කිරීම
            
            // 1. Buttons ඉවත් කිරීම
            await removeInlineKeyboard(ownerChatId, ownerMessageId); 
            
            // New Edited Message Text (ඔබ ඉල්ලූ format එක)
            const approvalDetails = `\n
*✅ STATUS: Approved by Owner!*
\n*User ID:* \`${targetUserId}\`
*User Name:* ${userFirstName}
*Message ID:* \`${userMessageId}\`
*Time:* ${currentTime} (SL Time)
\n_User Edit Status: ${userEditSuccess ? 'Success' : 'Failed'}_`;

            newOwnerMessage += approvalDetails;
            
            // 2. Text එක Edit කිරීම
            await editTelegramMessage(ownerChatId, ownerMessageId, newOwnerMessage); 
            
            await answerCallbackQuery(callbackQueryId, `✅ User ${targetUserId} ගේ Limit එක ඉවත් කර, ඔහුට දැනුම් දෙන ලදී.`, true);
            
        } else { // Rejected
            
            // User ගේ Original Message එක Edit කිරීම
            const rejectText = `❌ *Request Rejected* \n\n**Owner විසින් ඔබගේ Limit ඉල්ලීම ප්‍රතික්ෂේප කරන ලදී.** \n\nකරුණාකර හෙට දින නැවත උත්සාහ කරන්න.`;
            const userEditSuccess = await editTelegramMessage(userChatIdInt, userMessageIdInt, rejectText);

            // Owner ගේ Approval Message එක Edit කිරීම
            
            // 1. Buttons ඉවත් කිරීම
            await removeInlineKeyboard(ownerChatId, ownerMessageId);
            
            const rejectionDetails = `\n
*❌ STATUS: Rejected by Owner!*
\n*User ID:* \`${targetUserId}\`
*User Name:* ${userFirstName}
*Message ID:* \`${userMessageId}\`
*Time:* ${currentTime} (SL Time)
\n_User Edit Status: ${userEditSuccess ? 'Success' : 'Failed'}_`;

            newOwnerMessage += rejectionDetails;
            
            // 2. Text එක Edit කිරීම
            await editTelegramMessage(ownerChatId, ownerMessageId, newOwnerMessage);

            await answerCallbackQuery(callbackQueryId, `❌ User ${targetUserId} ගේ ඉල්ලීම ප්‍රතික්ෂේප කරන ලදී.`, true);
        }
        
        return new Response('Approval logic processed', { status: 200 });
    }
    
    // 3. (පැරණි Logic - Private Info Button)
    else if (data === 'SHOW_PRIVATE_INFO') {
        const privateMessage = `*✅ ඔබට පමණක් පෞද්ගලික තොරතුරු (Personalized Info)*\n\nමෙම තොරතුරු *ඔබට පමණක්* දර්ශනය වන ලෙස **Alert Box** එකක් මඟින් පෙන්වනු ලැබේ.\n\n*User ID:* \`${userId}\``;
        await answerCallbackQuery(callbackQueryId, privateMessage, true);
        return new Response('Callback query processed (private alert sent)', { status: 200 });

    } 
    
    // 4. Unknown/Done
    else {
        await answerCallbackQuery(callbackQueryId, "Processing...", false);
        return new Response('Callback query handled', { status: 200 });
    }
}

// --- 7. WORKER EXPORT (FINAL CODE) ---
export default {
    async scheduled(event, env, ctx) {
        // 1. Daily Content Generation (KV update logic inside)
        const postContent = await generateScheduledContent(env); 
        
        if (postContent) {
            
            let postStatus = [];
            
            // 2. 🌐 Telegram Channel එකට Post කිරීම
            const tgSuccess = await sendTelegramMessage(postContent); 
            postStatus.push(tgSuccess ? '✅ Telegram: Success' : '❌ Telegram: Failed');
            
            // 3. 🌐 Facebook Page/Group එකට Post කිරීම
            const fbSuccess = await sendFacebookPost(env, postContent); 
            postStatus.push(fbSuccess ? '✅ Facebook: Success' : '❌ Facebook: Failed');


            // 4. KV එකේ Post Status එක ගබඩා කිරීම
            const today = new Date().toISOString().slice(0, 10);
            if (tgSuccess || fbSuccess) { // අවම වශයෙන් එකක්වත් සාර්ථක නම් "POSTED" ලෙස සලකමු.
                await env.POST_STATUS_KV.put(`trading_post_posted:${today}`, "POSTED");
            } else {
                await env.POST_STATUS_KV.put(`trading_post_posted:${today}`, "FAILED");
            }
            
            // 5. Owner ට Final Status Message එක යැවීම
            const finalStatusMessage = `*⏰ Scheduled Daily Post Status (${today})*\n\n${postStatus.join('\n')}`;
            await sendTelegramReplyToOwner(finalStatusMessage, null);
        }
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Manual Daily Post Trigger for Testing
        if (url.pathname === '/trigger-manual') {
            try {
                 const postContent = await generateScheduledContent(env);
                 if (postContent) {
                    
                    let statusMessages = [];

                    // Telegram Post
                    const tgSuccess = await sendTelegramMessage(postContent); 
                    statusMessages.push(`Telegram Post: ${tgSuccess ? '✅ Success' : '❌ Failed'}`);
                    
                    // Facebook Post
                    const fbSuccess = await sendFacebookPost(env, postContent);
                    statusMessages.push(`Facebook Post: ${fbSuccess ? '✅ Success' : '❌ Failed'}`);
                    
                    const responseStatus = tgSuccess || fbSuccess ? 200 : 500;
                    const responseText = `*Manual Post Trigger Result:*\n\n${statusMessages.join('\n')}`;
                    
                    return new Response(responseText, { status: responseStatus, headers: { 'Content-Type': 'text/markdown' } });
                 }
                 return new Response('❌ Manual Daily Post Failed: Content Generation Failed. (Check logs)', { status: 500 });
            } catch (e) {
                 return new Response(`Error in Manual Trigger: ${e.message}`, { status: 500 });
            }
        }

        if (request.method === 'POST') {
            return handleWebhook(request, env);
        }
        
        return new Response('Worker running. Use the scheduled trigger, /trigger-manual, or set up the Telegram webhook.', { status: 200 });
    }
};
