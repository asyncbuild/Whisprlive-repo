/**
 * Generates a warm, delightful, and personalized greeting for returning hosts.
 * Combines time-of-day awareness with curated, brand-crafted greetings for WhisprLive.
 */
export function getSweetUserGreeting(username) {
  const cleanName = username?.trim() || "Host";
  const hour = new Date().getHours();

  // Time-of-day specific short greetings
  const morningGreetings = [
    `Good morning, ${cleanName}! ☀️`,
    `Morning, ${cleanName}! Ready to host? 👋`,
    `Good morning, ${cleanName}! 🎤`
  ];

  const afternoonGreetings = [
    `Good afternoon, ${cleanName}! 👋`,
    `Afternoon, ${cleanName}! Stage is ready. 🎤`,
    `Good afternoon, ${cleanName}! 🚀`
  ];

  const eveningGreetings = [
    `Good evening, ${cleanName}! 🌙`,
    `Evening, ${cleanName}! Ready to host? 🎤`,
    `Good evening, ${cleanName}! 🚀`
  ];

  const timeGreetings =
    hour < 12
      ? morningGreetings
      : hour < 17
        ? afternoonGreetings
        : eveningGreetings;

  // Short, punchy host greetings
  const generalGreetings = [
    `Welcome back, ${cleanName}! 👋`,
    `Hey ${cleanName}! Stage is yours. 🎤`,
    `Good to see you, ${cleanName}! 👋`,
    `Welcome back, ${cleanName}! 🚀`,
    `Hey ${cleanName}! Ready when you are. 🎤`,
    `Glad you're here, ${cleanName}! 👋`,
    `Welcome back, ${cleanName}! Let's go. 🚀`,
    `Hey ${cleanName}! Your room is ready. 💬`,
    `Welcome back, ${cleanName}! 😊`,
    `The stage is yours, ${cleanName}. 🎤`
  ];

  const allGreetings = [...timeGreetings, ...generalGreetings];
  const index = Math.floor(Math.random() * allGreetings.length);
  return allGreetings[index];
}

