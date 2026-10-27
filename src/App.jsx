import React, { useState } from "react";

const sheetEndpoint = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL?.trim();

function GiftIllustration() {
  return (
    <div className="gift-art" aria-hidden="true">
      <span className="sparkle sparkle-one">✦</span>
      <span className="sparkle sparkle-two">✳</span>
      <span className="sparkle sparkle-three">✦</span>
      <div className="gift-bow">
        <span />
        <span />
      </div>
      <div className="gift-box">
        <div className="gift-ribbon" />
        <div className="gift-lid">
          <div className="gift-lid-ribbon" />
        </div>
      </div>
      <div className="gift-shadow" />
    </div>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function checkPhoneEligibility(phone) {
  return new Promise((resolve, reject) => {
    if (!sheetEndpoint) {
      reject(new Error("Gift verification is not configured. Please try again later."));
      return;
    }

    const callbackName = `baateinEligibility_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Could not check your number. Please try again."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not check your number. Please try again."));
    };

    const separator = sheetEndpoint.includes("?") ? "&" : "?";
    script.src =
      `${sheetEndpoint}${separator}action=check` +
      `&phone=${encodeURIComponent(phone)}` +
      `&callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);
  });
}

function App() {
  const [step, setStep] = useState("welcome");
  const [eligibilityPhone, setEligibilityPhone] = useState("");
  const [eligibilityError, setEligibilityError] = useState("");
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    house: "",
    area: "",
    landmark: "",
    pincode: "",
    city: "",
    state: "",
  });
  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function useCurrentLocation() {
    setIsLocating(true);
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Location unavailable. Enter your address below.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${coords.latitude}&lon=${coords.longitude}`,
            { headers: { Accept: "application/json" } },
          );
          if (!response.ok) {
            throw new Error("Address lookup failed.");
          }

          const result = await response.json();
          const address = result.address ?? {};
          const city =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.county ||
            "";
          setForm((current) => ({
            ...current,
            house: current.house || address.house_number || "",
            area:
              current.area ||
              address.road ||
              address.neighbourhood ||
              address.suburb ||
              address.hamlet ||
              "",
            pincode: current.pincode || address.postcode || "",
            city: current.city || city,
            state: current.state || address.state || "",
          }));
          setLocationMessage("Address filled. Please check it.");
        } catch {
          setLocationMessage("Location added. Please enter your address.");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setLocationMessage("Could not get location. Enter your address below.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function openClaimForm() {
    setIsClaiming(true);
    window.setTimeout(() => {
      setStep("verify");
      setIsClaiming(false);
    }, 200);
  }

  async function verifyEligibility(event) {
    event.preventDefault();
    setEligibilityError("");
    const phone = eligibilityPhone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(phone)) {
      setEligibilityError("Enter a valid 10-digit mobile number.");
      return;
    }

    setIsCheckingEligibility(true);
    try {
      const result = await checkPhoneEligibility(phone);
      if (result?.status === "error") {
        throw new Error("Could not check your number. Please try again.");
      }
      if (result?.status === "already_claimed") {
        setEligibilityError("A gift has already been claimed with this number.");
        return;
      }
      if (!result?.eligible) {
        setEligibilityError("This number is not on the gift list.");
        return;
      }
      setForm((current) => ({ ...current, phone }));
      setStep("claim");
    } catch (error) {
      setEligibilityError(
        error instanceof Error
          ? error.message
          : "Could not check your number. Please try again.",
      );
    } finally {
      setIsCheckingEligibility(false);
    }
  }

  async function submitClaim(event) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    const payload = {
      ...form,
      phone: form.phone.replace(/\D/g, ""),
      pincode: form.pincode.replace(/\D/g, ""),
      country: "India",
      location,
      submittedAt: new Date().toISOString(),
    };

    try {
      if (sheetEndpoint) {
        await fetch(sheetEndpoint, {
          method: "POST",
          mode: "no-cors",
          body: new URLSearchParams({ payload: JSON.stringify(payload) }),
        });
      }
      setStep("thanks");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The gift claim could not be sent. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Baatein home">
          <img src="/assets/baatein-logo.png" alt="Baatein" />
        </a>
      </header>

      {step === "welcome" && (
        <section
          className={`welcome-card screen-enter${isClaiming ? " is-leaving" : ""}`}
          aria-labelledby="welcome-title"
        >
          <div className="welcome-copy">
            <h1 id="welcome-title">
              You’ve earned
              <br />
              a little <span>something.</span>
            </h1>
            <p className="welcome-text">
              Thanks for being a valued partner.
            </p>
            <button
              className={`primary-button claim-button${isClaiming ? " is-claiming" : ""}`}
              disabled={isClaiming}
              onClick={openClaimForm}
            >
              Claim your gift <span aria-hidden="true">→</span>
            </button>
          </div>
          <GiftIllustration />
        </section>
      )}

      {step === "claim" && (
        <section className="form-card screen-enter" aria-labelledby="claim-title">
          <div className="form-intro">
            <button className="back-button" onClick={() => setStep("verify")}>
              <span aria-hidden="true">←</span> Back
            </button>
            <p className="eyebrow"><span /> Gift delivery</p>
            <h1 id="claim-title">Your details</h1>
          </div>

          <form onSubmit={submitClaim}>
            <div className="form-grid">
              <label className="field field-wide">
                <span>Your name</span>
                <input
                  autoComplete="name"
                  name="name"
                  onChange={updateField}
                  placeholder="Name"
                  required
                  value={form.name}
                />
              </label>

              <label className="field field-wide">
                <span>Mobile number</span>
                <div className="phone-input">
                  <span aria-hidden="true">+91</span>
                  <input
                    autoComplete="tel-national"
                    name="phone"
                    readOnly
                    value={form.phone}
                  />
                </div>
                <span className="field-note">Number verified</span>
              </label>

              <div className="field field-wide location-field">
                <button
                  className="location-button"
                  disabled={isLocating}
                  onClick={useCurrentLocation}
                  type="button"
                >
                  <LocationIcon />
                  {isLocating
                    ? "Finding your address..."
                    : location
                      ? "Update from my location"
                      : "Use my current location"}
                  <span aria-hidden="true">↗</span>
                </button>
                <p className="field-hint" aria-live="polite">
                  {locationMessage || "Fills in your address where available."}
                  {location && (
                    <> {" "}· <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></>
                  )}
                </p>
              </div>

              <label className="field field-wide">
                <span>House / flat number</span>
                <input
                  autoComplete="address-line1"
                  name="house"
                  onChange={updateField}
                  placeholder="House / flat number"
                  required
                  value={form.house}
                />
              </label>

              <label className="field field-wide">
                <span>Street / area</span>
                <input
                  autoComplete="address-line2"
                  name="area"
                  onChange={updateField}
                  placeholder="Street or area"
                  required
                  value={form.area}
                />
              </label>

              <label className="field">
                <span>Landmark <em>(optional)</em></span>
                <input
                  autoComplete="address-line3"
                  name="landmark"
                  onChange={updateField}
                  placeholder="Nearby place"
                  value={form.landmark}
                />
              </label>

              <label className="field">
                <span>PIN code</span>
                <input
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength="6"
                  minLength="6"
                  name="pincode"
                  onChange={updateField}
                  pattern="[0-9]{6}"
                  placeholder="6-digit PIN code"
                  required
                  value={form.pincode}
                />
              </label>

              <label className="field">
                <span>City / village</span>
                <input
                  autoComplete="address-level2"
                  name="city"
                  onChange={updateField}
                  placeholder="City or village"
                  required
                  value={form.city}
                />
              </label>

              <label className="field">
                <span>State</span>
                <input
                  autoComplete="address-level1"
                  name="state"
                  onChange={updateField}
                  placeholder="State"
                  required
                  value={form.state}
                />
              </label>
            </div>

            {formError && <p className="form-error" role="alert">{formError}</p>}

            <button className="primary-button submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending..." : "Send my gift"}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>
        </section>
      )}

      {step === "verify" && (
        <section className="form-card screen-enter verify-card" aria-labelledby="verify-title">
          <div className="form-intro">
            <button className="back-button" onClick={() => setStep("welcome")}>
              <span aria-hidden="true">←</span> Back
            </button>
            <p className="eyebrow"><span /> Gift check</p>
            <h1 id="verify-title">Enter your mobile number</h1>
          </div>

          <form onSubmit={verifyEligibility}>
            <label className="field field-wide">
              <span>Mobile number</span>
              <div className="phone-input">
                <span aria-hidden="true">+91</span>
                <input
                  autoComplete="tel-national"
                  autoFocus
                  inputMode="numeric"
                  maxLength="10"
                  minLength="10"
                  onChange={(event) => {
                    setEligibilityPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                    setEligibilityError("");
                  }}
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile number"
                  required
                  value={eligibilityPhone}
                />
              </div>
            </label>

            {eligibilityError && (
              <p className="form-error" role="alert">{eligibilityError}</p>
            )}

            <button className="primary-button submit-button" disabled={isCheckingEligibility} type="submit">
              {isCheckingEligibility ? "Checking..." : "Check number"}
              {!isCheckingEligibility && <span aria-hidden="true">→</span>}
            </button>
          </form>
        </section>
      )}

      {step === "thanks" && (
        <section className="thanks-card screen-enter" aria-labelledby="thanks-title">
          <div className="thanks-icon" aria-hidden="true">
            <span>✓</span>
          </div>
          <h1 id="thanks-title">Thank you, {form.name}!</h1>
          <p className="thanks-text">
            We’ll deliver your gift soon.
          </p>
          {!sheetEndpoint && (
            <p className="demo-note">Demo only — claims aren’t saved yet.</p>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
