# Requirements: QR stitch code (F7)

Feature F7 in PLAN.md section 5. Judging criterion: Innovation/Idea.

## Introduction

A stitch code is a QR code that holds the user's answers, encrypted with a passphrase, so a second visit refills the form in seconds. Nothing is stored on a server and nothing is stored in the browser: the QR code (or an equivalent `.stitch` file) and the passphrase stay with the user.

## Glossary

- **Stitch code**: the encrypted bytes, shown as a QR code or saved as a `.stitch` file.
- **Generated passphrase**: five words picked at random from a 7,776-word list.
- **Header**: the unencrypted first bytes of a stitch code: format version, key-derivation settings, salt and IV.

## Requirements

### Requirement 1: Passphrase

**User story:** As a user, I want a passphrase that is easy to write down and hard to guess, so that only I can open my stitch code.

#### Acceptance criteria

1.1 WHEN the user creates a stitch code THE SYSTEM SHALL offer a generated passphrase by default: 5 words chosen with `crypto.getRandomValues` from a bundled 7,776-word list, each word chosen uniformly (no modulo bias), giving about 64 bits of entropy.

1.2 WHEN the user asks for a new generated passphrase THE SYSTEM SHALL generate a fresh one.

1.3 IF the user types their own passphrase THEN THE SYSTEM SHALL require at least 16 characters after trimming and Unicode NFC normalisation.

1.4 IF a custom passphrase, compared in lower case, appears in the bundled common-password list THEN THE SYSTEM SHALL reject it with a plain message.

1.5 THE SYSTEM SHALL NOT store, log or include the passphrase in the stitch code.

### Requirement 2: Key derivation and encryption

2.1 THE SYSTEM SHALL derive a 256-bit AES-GCM key from the passphrase with PBKDF2-HMAC-SHA256, 600,000 iterations and a new random 16-byte salt per stitch code.

2.2 THE SYSTEM SHALL encrypt with AES-GCM using a new random 12-byte IV per stitch code and a 128-bit authentication tag.

2.3 THE SYSTEM SHALL write a header holding a magic value, the format version, the key-derivation algorithm ID, the iteration count, the salt and the IV, and SHALL authenticate the header as AES-GCM additional data so that any change to it makes decryption fail.

2.4 WHEN reading a stitch code THE SYSTEM SHALL use the iteration count from the header and SHALL reject counts below 600,000 or above 10,000,000.

2.5 WHILE the key is being derived THE SYSTEM SHALL show progress text and keep the page responsive, and SHALL record the measured derivation time for the honest report in KIRO_USAGE.md and README.

### Requirement 3: Payload content

3.1 THE SYSTEM SHALL put only the form ID and, per field, the text the user entered for that field into the plaintext.

3.2 THE SYSTEM SHALL NOT include LLM API keys, the form image, signature images or the passphrase.

3.3 THE SYSTEM SHALL compress the plaintext before encrypting it.

3.4 WHEN decompressing THE SYSTEM SHALL stop and fail if the output exceeds 64 KiB.

### Requirement 4: QR code and file

4.1 WHEN the stitch code fits in one QR code in byte mode at error-correction level M THE SYSTEM SHALL show it as a QR image with a text alternative and a download button.

4.2 IF the stitch code is too large for one QR code THEN THE SYSTEM SHALL say so and offer the same bytes as a downloadable `.stitch` file.

4.3 WHEN the user scans a stitch code with the camera or uploads an image of one THE SYSTEM SHALL decode it in the browser.

4.4 WHEN the user opens a `.stitch` file THE SYSTEM SHALL read it the same way as a scanned QR code.

### Requirement 5: Opening and refilling

**User story:** As a returning user, I want to scan my stitch code, type my passphrase and see my form filled again.

#### Acceptance criteria

5.1 WHEN the passphrase is right THE SYSTEM SHALL return exactly the answers that were encrypted and refill the form by running the mapper on them.

5.2 IF the passphrase is wrong, or any byte of the stitch code was changed THEN THE SYSTEM SHALL show "This stitch code could not be opened with that passphrase" and SHALL NOT show or use any partial data.

5.3 IF the decrypted form ID is not the current form THEN THE SYSTEM SHALL say which sample or form it belongs to and ask before refilling.

5.4 IF the bytes are not a stitch code (wrong magic value or unknown version) THEN THE SYSTEM SHALL say "This is not a Stitchform stitch code".

### Requirement 6: Honest warnings

6.1 WHEN a stitch code is shown THE SYSTEM SHALL warn that anyone who has both the QR code and the passphrase can read the answers, and advise keeping them apart.

6.2 THE SYSTEM SHALL state that nothing is stored on a server and that losing the passphrase means the answers cannot be recovered.
