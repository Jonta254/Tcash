import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupUser } from "../../services";

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    mpesaPhoneNumber: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    try {
      signupUser(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-bg">
      <div className="auth-layout auth-layout-single">
        <section className="auth-card stack auth-entry-card">
          <div>
            <span className="brand-kicker">Admin setup</span>
            <h2>Create a local account</h2>
            <p className="muted">
              This page is only for local admin or test setup. Normal users should continue with
              World App sign-in so their username is attached to each Tcash order.
            </p>
          </div>

          {error ? <div className="error">{error}</div> : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                name="fullName"
                placeholder="Jane Doe"
                value={form.fullName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                placeholder="0712345678"
                value={form.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="mpesaPhoneNumber">M-Pesa Payout Number</label>
              <input
                id="mpesaPhoneNumber"
                name="mpesaPhoneNumber"
                placeholder="0712345678"
                value={form.mpesaPhoneNumber}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="button">
              Create Account
            </button>
          </form>

          <p className="muted">
            Already registered? <Link to="/login" className="text-link">Login instead</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default SignupPage;
