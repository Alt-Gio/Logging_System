# OTP Verification System Implementation Plan

## Overview
Add OTP (One-Time Password) verification to the front page for PC and Internet rental to ensure client legitimacy.

---

## Requirements

### 1. Contact Information
- ✅ Add contact number field to front page form
- ✅ Ask for client contact preference: Email or Phone
- ✅ Make form more streamlined and responsive

### 2. OTP Verification
- ✅ Apply OTP verification for:
  - PC rental only
  - PC + Internet rental
- ✅ Skip OTP for other purposes (consultation, printing, etc.)

### 3. OTP Delivery Methods
- **Email OTP:** Use Resend (already integrated)
- **SMS OTP:** Use free SMS service

---

## Free SMS OTP Services Recommendation

### **Best Option: Twilio (Free Trial)**
- **Free Credits:** $15.75 trial credit (enough for ~500 SMS)
- **Pricing After Trial:** $0.0079/SMS for Philippines
- **Pros:**
  - Most reliable
  - Great documentation
  - Easy integration
  - Supports Philippines numbers
- **Cons:**
  - Requires credit card for trial
  - Not completely free long-term

### **Alternative 1: Vonage (Nexmo) - Free Trial**
- **Free Credits:** €2 trial credit (~100 SMS)
- **Pricing After Trial:** €0.04/SMS
- **Pros:**
  - Good reliability
  - Easy API
- **Cons:**
  - Limited free credits
  - Requires verification

### **Alternative 2: Termii (Africa-focused but works globally)**
- **Free Credits:** Some free SMS on signup
- **Pricing:** Very affordable
- **Pros:**
  - Affordable
  - Works in Philippines
- **Cons:**
  - Less known
  - May have delivery issues

### **Alternative 3: SMS Gateway API (Philippines-specific)**
- **Semaphore:** Philippine SMS gateway
- **Pricing:** ₱0.50-1.00 per SMS
- **Pros:**
  - Local provider
  - Reliable for PH numbers
  - No trial needed
- **Cons:**
  - Not free
  - Requires load purchase

### **Recommended Approach:**
1. **Start with Twilio free trial** ($15.75 credit = ~500 SMS)
2. **Use Email OTP as primary** (free via Resend)
3. **SMS as secondary option** for users without email
4. **After trial ends:** Either:
   - Pay for Twilio (most reliable)
   - Switch to Semaphore (local PH provider)
   - Make SMS optional, email primary

---

## Implementation Plan

### Phase 1: Update Front Page Form
1. Add contact preference selector (Email/Phone)
2. Add phone number field (conditional)
3. Add email field (conditional)
4. Make form responsive and streamlined
5. Add validation for phone/email format

### Phase 2: Create OTP System
1. Create OTP generation logic (6-digit code)
2. Store OTP in database with expiry (5 minutes)
3. Create API endpoint: `/api/otp/send`
4. Create API endpoint: `/api/otp/verify`

### Phase 3: Integrate Delivery Services
1. **Email OTP:** Use existing Resend integration
2. **SMS OTP:** Integrate Twilio API
3. Add environment variables for API keys

### Phase 4: Update Log-in Flow
1. Check if service requires OTP (PC rental or PC+Internet)
2. Show OTP verification step after form submission
3. Verify OTP before creating log entry
4. Show success message after verification

### Phase 5: UI/UX Improvements
1. Streamlined multi-step form
2. Progress indicator
3. Clear instructions
4. Error handling
5. Resend OTP option

---

## Database Schema

### New Table: `otp_verifications`
```sql
CREATE TABLE otp_verifications (
  id TEXT PRIMARY KEY,
  contact TEXT NOT NULL,           -- email or phone
  contact_type TEXT NOT NULL,      -- 'email' or 'phone'
  otp_code TEXT NOT NULL,          -- 6-digit code
  purpose TEXT NOT NULL,           -- 'pc_rental' or 'internet_rental'
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Environment Variables Needed

```env
# Twilio SMS (for OTP)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Resend Email (already configured)
RESEND_API_KEY=re_xxx (already set)
```

---

## User Flow

### For PC/Internet Rental:

1. **Step 1: Basic Info**
   - Name, Agency, Purpose
   - Select: "Renting PC" or "PC + Internet"

2. **Step 2: Contact Info**
   - Choose: Email or Phone
   - Enter contact details

3. **Step 3: OTP Verification**
   - System sends OTP
   - User enters 6-digit code
   - Verify and proceed

4. **Step 4: Success**
   - Log entry created
   - Show confirmation

### For Other Services (No OTP):
1. Basic info form
2. Submit directly
3. Success

---

## Security Features

1. **OTP Expiry:** 5 minutes
2. **Rate Limiting:** Max 3 OTP requests per contact per hour
3. **Code Format:** 6-digit numeric
4. **Single Use:** OTP invalidated after verification
5. **Secure Storage:** Hash OTP codes in database

---

## Cost Estimation

### Using Twilio:
- **Free Trial:** 500 SMS (~2-3 months for small office)
- **After Trial:** $0.0079/SMS × 100 SMS/month = **$0.79/month**

### Using Email (Resend):
- **Free Tier:** 3,000 emails/month
- **Cost:** **FREE**

### Recommendation:
- **Primary:** Email OTP (free, unlimited)
- **Secondary:** SMS OTP (for users without email)
- **Expected cost:** $0-2/month

---

## Next Steps

1. ✅ Get Twilio account and API keys
2. ✅ Update front page form
3. ✅ Create OTP API endpoints
4. ✅ Implement verification flow
5. ✅ Test with real phone numbers
6. ✅ Deploy to Railway

---

## Testing Checklist

- [ ] Email OTP sends correctly
- [ ] SMS OTP sends correctly
- [ ] OTP verification works
- [ ] OTP expiry works (5 min)
- [ ] Rate limiting works
- [ ] Form validation works
- [ ] Responsive design works
- [ ] Error messages clear
- [ ] Success flow smooth
- [ ] Database stores OTPs correctly
