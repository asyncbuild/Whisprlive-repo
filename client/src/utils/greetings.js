/**
 * Generates a warm, delightful, and personalized greeting for returning hosts.
 * Combines time-of-day awareness with curated, brand-crafted greetings for WhisprLive.
 */
export function getSweetUserGreeting(username) {
  const cleanName = username?.trim() || "Host";
  const hour = new Date().getHours();

  // Time-of-day specific greetings
  const morningGreetings = [
    `Good morning, ${cleanName}! ☀️ Ready to get things started?`,
    `Morning, ${cleanName}! ☀️ Your next event awaits.`,
    `Good morning, ${cleanName}! Let's make today interactive. 👋`
  ];

  const afternoonGreetings = [
    `Good afternoon, ${cleanName}! 👋 Ready for your next session?`,
    `Afternoon, ${cleanName}! 🎤 Let's get your audience involved.`,
    `Good afternoon, ${cleanName}! Your stage is ready. 🎤`
  ];

  const eveningGreetings = [
    `Good evening, ${cleanName}! 🌙 Ready to bring the room to life?`,
    `Evening, ${cleanName}! 🌙 Let's make this session count.`,
    `Good evening, ${cleanName}! 🎤 Time to get the conversation going.`
  ];

  const timeGreetings =
    hour < 12
      ? morningGreetings
      : hour < 17
        ? afternoonGreetings
        : eveningGreetings;

  // Curated master pool of WhisprLive greetings
  const generalGreetings = [
    // ⭐ Host Favorites
    `Welcome back, ${cleanName}! 👋 Ready for your next event?`,
    `Hey ${cleanName}! 🎤 The stage is yours.`,
    `Good to see you again, ${cleanName}! 👋`,
    `Welcome back, ${cleanName}! Let's get the room talking. 💬`,
    `Hey ${cleanName}! Ready to bring your next event to life? 🚀`,
    `Welcome back, ${cleanName}! Let's make every voice count. 💬`,
    `Your audience is waiting, ${cleanName}. 👀`,
    `Welcome back, ${cleanName}! Ready to hear what the room has to say? 💬`,
    `The room is yours, ${cleanName}. 🎤`,
    `Hey ${cleanName}! Let's make this one memorable. 🚀`,
    `Welcome back, ${cleanName}! Time to let the room speak. 💬`,
    `Ready when you are, ${cleanName}. 🚀`,
    `Hey ${cleanName}! Let's make your next session interactive. 🎤`,
    `Welcome back, ${cleanName}! Your next great session starts here. 🚀`,
    `Nice to see you again, ${cleanName}! 👋`,
    `Welcome back, ${cleanName}! Let's give your audience a voice. 🎤`,
    `Another session, another conversation. Welcome back, ${cleanName}! 💬`,
    `Hey ${cleanName}! What will your audience say this time? 👀`,
    `Welcome back, ${cleanName}! Let's make the room come alive. 🚀`,
    `Good to have you back, ${cleanName}. Let's begin. 👋`,

    // 👋 Warm & Welcoming
    `Welcome back, ${cleanName}! 👋`,
    `Hey ${cleanName}, good to see you again! 👋`,
    `Lovely to have you back, ${cleanName}! 😊`,
    `Welcome back, ${cleanName}! Ready when you are.`,
    `Hey ${cleanName}! Your WhisprLive space is ready. 🚀`,
    `Welcome back, ${cleanName}! Let's make something great.`,
    `Hey ${cleanName}! Glad you're here. 👋`,
    `Back again, ${cleanName}? We like that. 😉`,

    // 🎤 Event-Focused & Interactive
    `Welcome back, ${cleanName}! 🎤 The stage is yours.`,
    `Ready for another great session, ${cleanName}? 🎤`,
    `Hey ${cleanName}! Let's get your audience talking. 💬`,
    `Welcome back, ${cleanName}! Time to make your next event interactive. 🎤`,
    `Your next event starts here, ${cleanName}. 🚀`,
    `Hey ${cleanName}! Let's make some noise in the room. 🔥`,
    `Welcome back, ${cleanName}! Let's get the conversation started. 💬`,
    `Ready to turn an audience into a conversation, ${cleanName}? 👋`,

    // 🧠 Brand & Community Focused
    `Welcome back, ${cleanName}! Let's hear what the room has to say. 💬`,
    `Hey ${cleanName}! You host the event. We bring the voices. 🎤`,
    `The room is yours, ${cleanName}. Let's make it interactive. 🚀`,
    `Welcome back, ${cleanName}! Ready to turn a crowd into a conversation?`,
    `Hey ${cleanName}! Let's make your audience part of the story. 💬`,
    `Welcome back, ${cleanName}! Questions, opinions, ideas — let's hear them all. 💬`,
    `Your audience is here. Let's give them a voice, ${cleanName}. 🎤`,

    // 😄 Playful & Engaging
    `Look who's back! 👀 Welcome, ${cleanName}.`,
    `The host has entered the room. 🎤 Welcome back, ${cleanName}!`,
    `And we're back, ${cleanName}! 🚀`,
    `Hey ${cleanName}! We saved you a spot. 😉`,
    `Back on stage, ${cleanName}? 🎤`,
    `WhisprLive missed you, ${cleanName}. 👋`,
    `Ready for round two, ${cleanName}? 🚀`,

    // 💬 Conversation & Feedback Focused
    `Ready to hear what your audience really thinks, ${cleanName}?`,
    `Your audience has something to say, ${cleanName}.`,
    `Let's turn questions into conversations, ${cleanName}. 💬`,
    `Ready to hear from the room, ${cleanName}? 👂`,
    `Let's make your audience part of the conversation, ${cleanName}.`
  ];

  // Combine time-of-day greetings with the general pool for natural variety
  const allGreetings = [...timeGreetings, ...generalGreetings];

  const index = Math.floor(Math.random() * allGreetings.length);
  return allGreetings[index];
}
