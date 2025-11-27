// --- 0. CONFIGURATION (Keys සහ IDs සෘජුවම කේතයේ - Insecure) ---
// ⚠️ ඔබේ සැබෑ අගයන් සමඟ යාවත්කාලීන කරන්න ⚠️

const CONFIG = {
    // 🛑 ඔබේ Bot Token එක
    TELEGRAM_BOT_TOKEN: "5100305269:AAEHxCE1z9jCFZl4b0-yoRfVfojKBRKSL0Q",
    
    // 🛑 ඔබේ Channel/Group Chat ID එක (Scheduled Post සඳහා)
    TELEGRAM_CHAT_ID: "1901997764", // OWNER_CHAT_ID එක ලෙසම තිබිය යුතුය
    
    // 🛑 ඔබේ පුද්ගලික Chat ID එක (Rate Limit අදාළ නොවන Owner ID)
    OWNER_CHAT_ID: "6762786795",
    
    // 🛑 ඔබේ අලුත්ම Gemini API Key එක
    GEMINI_API_KEY: "AIzaSyDXf3cIysV1nsyX4vuNrBrhi2WCxV44pwA",
    
    // Telegram API Endpoint Base URL එක
    TELEGRAM_API_BASE: `https://api.telegram.org/bot5100305269:AAEHxCE1z9jCFZl4b0-yoRfVfojKBRKSL0Q`,
    
    // දිනකට උපරිම අවසර ලත් භාවිතය
    DAILY_LIMIT: 5
};

// --- 1. CORE AI FUNCTIONS ---

// A. Gemini API call for Daily Scheduled Posts
async function generateScheduledContent(coveredTopics) {
    const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const excludedTopicsString = coveredTopics.join(', ');
    
    // 🛑 සිංහල භාෂාව ඉල්ලීමට වෙනස් කරන ලදි
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
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    } catch (e) {
        return null;
    }
}

// B. Gemini API call for Live Chatbot Replies (Full Post Format)
async function generateReplyContent(userQuestion) {
    const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const systemPrompt = `
        You are a detailed, expert financial and trading assistant. A user has asked you a specific question.
        
        Your task is to:
        1. Use the 'google_search' tool to get the most accurate and educational information for the user's question.
        2. Generate a **DETAILED, EDUCATIONAL RESPONSE**. The response must be **5 PARAGRAPHS** long.
        3. Use **clear SINHALA language (සිංහල අක්ෂර / Unicode)** mixed with necessary English trading terms throughout the response.
        4. The response must be well-formatted using Telegram's **Markdown**.
        5. The first line of the response MUST be a clear title based on the question.

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
        
        // Error code check (Rate Limit, Invalid Key)
        if (data.error) {
             console.error("Gemini API Error:", data.error);
             return `🛑 *API Error:* ${data.error.message || 'මට පිළිතුරු දීමට නොහැකි විය. (Gemini API දෝෂයක්)'}`;
        }
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "මට එම ප්‍රශ්නයට පිළිතුරු දීමට නොහැකි විය. (Content Missing)";

    } catch (e) {
        console.error("Network or Exception Error:", e);
        return "මට එම ප්‍රශ්නයට පිළිතුරු දීමට නොහැකි විය. (Network හෝ Timeout දෝෂයක්)";
    }
}

// C. (පෙර තිබූ validateTopic ශ්‍රිතය ඉවත් කරන ලදි - Topic Validation දැන් අක්‍රියයි)


// --- 2. CORE TELEGRAM FUNCTIONS ---

// D. Telegram API call (Send Text Message - Manual Post)
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

// E. Telegram API call (User Reply Send කිරීමට)
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

// F. පණිවිඩයක් Edit කිරීමට
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

// G. Keyboard එකක් සමඟ පණිවිඩයක් Edit කිරීමට (Limit Message සඳහා)
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

// --- 3. HELPER FUNCTIONS ---

function extractTopicFromPost(postText) {
    if (!postText) return 'Unknown Topic';
    const titleLine = postText.split('\n')[0].trim();
    return titleLine.substring(0, 50).replace(/[*_]/g, '').trim();
}

// H. Owner ගේ Contact Link එක ලබා දේ
function getOwnerContactLink() {
    const ownerUsername = 'Mrchamo_Lk';
    return `https://t.me/${ownerUsername}`;
}

// I. දෛනික භාවිතය පරීක්ෂා කිරීම සහ වැඩි කිරීම
async function checkAndIncrementUsage(env, chatId) {
    if (chatId.toString() === CONFIG.OWNER_CHAT_ID.toString()) {
        return { allowed: true, count: 'Unlimited' };
    }

    const today = new Date().toISOString().slice(0, 10);
    const KV_KEY = `usage:${today}:${chatId}`;

    const currentUsageStr = await env.POST_STATUS_KV.get(KV_KEY);
    let currentUsage = parseInt(currentUsageStr) || 0;

    if (currentUsage >= CONFIG.DAILY_LIMIT) {
        return { allowed: false, count: currentUsage };
    }

    currentUsage += 1;
    
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0); 
    const expirationTtl = Math.max(1, Math.ceil((endOfDay.getTime() - now.getTime()) / 1000));
    
    await env.POST_STATUS_KV.put(KV_KEY, currentUsage.toString(), { expirationTtl: expirationTtl });

    return { allowed: true, count: currentUsage };
}


// --- 4. MAIN WORKFLOW (FOR SCHEDULED POSTS) ---

async function runDailyPostWorkflow(env) {
    if (!env.POST_STATUS_KV) return { success: false, message: 'KV Binding is missing.' };

    const todayKey = new Date().toISOString().slice(0, 10);
    const DAILY_POST_KV_KEY = `trading_post_posted:${todayKey}`;
    const TOPICS_COVERED_KV_KEY = `TRADING_TOPICS_COVERED`;

    const status = await env.POST_STATUS_KV.get(DAILY_POST_KV_KEY);
    if (status === 'POSTED') return { success: true, message: 'Trading Post already sent.' };
    
    const coveredTopicsJson = await env.POST_STATUS_KV.get(TOPICS_COVERED_KV_KEY) || '["Support and Resistance", "Candlesticks", "Money Management"]';
    let coveredTopics;
    try {
        coveredTopics = JSON.parse(coveredTopicsJson);
    } catch (e) {
        coveredTopics = ["Support and Resistance", "Candlesticks", "Money Management"];
    }

    const postText = await generateScheduledContent(coveredTopics);
    if (!postText) return { success: false, message: 'Failed to generate content via Gemini.' };
    
    const postSuccess = await sendTelegramMessage(postText);

    if (postSuccess) {
        await env.POST_STATUS_KV.put(DAILY_POST_KV_KEY, 'POSTED', { expirationTtl: 86400 });
        
        const newTopic = extractTopicFromPost(postText);
        if (!coveredTopics.includes(newTopic)) {
            coveredTopics.push(newTopic);
        }
        await env.POST_STATUS_KV.put(TOPICS_COVERED_KV_KEY, JSON.stringify(coveredTopics));
        
        return { success: true, message: 'Daily trading education post completed successfully.' };
    } else {
        return { success: false, message: 'Telegram post failed.' };
    }
}

// --- 5. WORKER ENTRY POINT (Handles Webhook) ---

async function handleWebhook(request, env) {
    try {
        const update = await request.json();
        
        if (update && update.message && update.message.text) {
            const message = update.message;
            const chatId = message.chat.id;
            const messageId = message.message_id;
            const text = message.text.trim();
            
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
                if (command === '/start' || command === '/help') {
                    const welcomeMessage = "👋 *Welcome to the Trading Assistant Bot!* \n\nMata answer karanna puluwan **Trading, Finance, saha Crypto** related questions walata witharai. \n\n*Limit:* Dawasakata *Trading Questions 5* k withirai. (Owner ta unlimited). \n\nTry karanna: 'Order Flow කියන්නේ මොකද්ද?' wage prashnayak ahanna.";
                    await sendTelegramReply(chatId, welcomeMessage, messageId);
                }
                return new Response('Command processed', { status: 200 });
            }

            // --- TRADING QUESTION LOGIC (Topic Validation Removed) ---
            if (text.length > 5) {
                
                // 1. 🚦 Status Message
                const validationMessageId = await sendTelegramReply(chatId, "🌐 *ප්‍රශ්නය සකස් කරමින්...*", messageId);
                // Note: Topic validation (validateTopic function call) is removed. All queries proceed.
                
                // 2. 🛑 Rate Limit Check
                const usageResult = await checkAndIncrementUsage(env, chatId);
                
                if (!usageResult.allowed) {
                    const limitMessage = `🛑 *Usage Limit Reached!* \n\nSorry, oyage **Trading Questions 5** (limit eka) ada dawasata iwarai. \n\n*Reset wenawa:* Midnight 12.00 AM walata. \n\n*Oyata unlimited access one nam,* ownerwa contact karanna:`;
                    
                    const keyboard = [
                        [{ text: "👑 Limit Eka Ain Kara Ganna (Contact Owner)", url: getOwnerContactLink() }]
                    ];
                    
                    await editTelegramMessageWithKeyboard(chatId, validationMessageId, limitMessage, keyboard);
                    return new Response('Rate limited with inline button', { status: 200 });
                }
                
                // 3. 🌐 Searching Status
                await editTelegramMessage(chatId, validationMessageId, "🌐 *Web එක Search කරමින්...* (Finding up-to-date info)");
                
                // 4. 🧠 Generation Status
                await editTelegramMessage(chatId, validationMessageId, "✍️ *සිංහල Post එකක් සකස් කරමින්...* (Generating detailed reply)");
                
                // 5. 🔗 Final Content Generation
                const replyText = await generateReplyContent(text);
                
                // 6. ✅ Final Edit - සම්පූර්ණ පිළිතුර Message එකට යැවීම
                await editTelegramMessage(chatId, validationMessageId, replyText);
            }
        }
    } catch (e) {
        console.error("Error processing webhook:", e);
    }
    
    return new Response('OK', { status: 200 });
}

export default {
    // Cron Trigger (ස්වයංක්‍රීය ක්‍රියාත්මක වීම)
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runDailyPostWorkflow(env));
    },

    // Manual Trigger / Webhook Handler
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // 1. Manual Trigger for Daily Post
        if (url.pathname === '/trigger-manual') {
            const result = await runDailyPostWorkflow(env);
            return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Telegram Webhook Handler (POST Request)
        if (request.method === 'POST') {
            return handleWebhook(request, env);
        }
        
        return new Response('Worker running. Use the scheduled trigger, /trigger-manual, or set up the Telegram webhook.', { status: 200 });
    }
};
