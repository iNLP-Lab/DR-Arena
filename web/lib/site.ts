export const MODEL_SUBMISSION_EMAIL = "wxzhang@sutd.edu.sg";
export const MODEL_SUBMISSION_SUBJECT = "Deep Research Arena Model Submission";
export const MODEL_SUBMISSION_BODY = [
  "Hello Deep Research Arena team,",
  "",
  "I would like to submit a model for consideration on the leaderboard.",
  "",
  "Model name:",
  "Provider:",
  "Access method / API endpoint:",
  "Public documentation URL:",
  "Short description:",
  "",
  "Anything else we should know:",
  "",
  "Best,",
  "",
].join("\n");

export const MODEL_SUBMISSION_MAILTO =
  `mailto:${MODEL_SUBMISSION_EMAIL}?subject=${encodeURIComponent(MODEL_SUBMISSION_SUBJECT)}&body=${encodeURIComponent(MODEL_SUBMISSION_BODY)}`;

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function publicAssetPath(path: `/${string}`) {
  return `${BASE_PATH}${path}`;
}
