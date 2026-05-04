const RECAPTCHA_SITE_KEY = "your recaptcha key";
const RECAPTCHA_API_KEY = "your recaptcha api key";
const RECAPTCHA_URL = `your recaptcha verification url`;
const RECAPTCHA_ACTION = "submit";

function showRecaptchaError() {
  showToast("error", "Error: Can not verify Recaptcha!");
}

async function verifyRecaptcha(action = RECAPTCHA_ACTION) {
  const token = await new Promise((resolve, reject) => {
    try {
      grecaptcha.enterprise.ready(async () => {
        try {
          const t = await grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, {
            action: action,
          });
          resolve(t);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  const payload = {
    event: {
      token,
      siteKey: RECAPTCHA_SITE_KEY,
      expectedAction: action,
    },
  };

  const res = await fetch(RECAPTCHA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  return Boolean(result?.tokenProperties?.valid);
}

async function withRecaptcha(
  handler,
  action = RECAPTCHA_ACTION,
  onFail = showRecaptchaError,
) {
  try {
    const ok = await verifyRecaptcha(action);
    if (!ok) throw new Error("Can not verify recaptcha!");
    await handler();
  } catch (err) {
    console.log("recaptcha NOT...");
    console.error(err);
    onFail();
  }
}
