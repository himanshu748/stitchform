// DEMO DATA. Planned field labels of the three fictional sample forms (sample-forms spec,
// requirements 1.1 to 1.4 and design.md "Template content"), in English with the Hindi
// translation printed next to it. The templates written in the sample-forms feature must use
// these labels, or this list and the synonym files must be updated with them.

export interface SampleLabel {
  form: 'sample-lantern-hill-admission' | 'sample-moonfield-scholarship' | 'sample-hollowbrook-hostel';
  fieldId: string;
  en: string;
  hi: string;
}

export const SAMPLE_LABELS: readonly SampleLabel[] = [
  { form: 'sample-lantern-hill-admission', fieldId: 'full-name', en: 'Full name', hi: 'पूरा नाम' },
  { form: 'sample-lantern-hill-admission', fieldId: 'dob', en: 'Date of birth', hi: 'जन्म तिथि' },
  { form: 'sample-lantern-hill-admission', fieldId: 'guardian-name', en: 'Parent or guardian name', hi: 'माता-पिता या अभिभावक का नाम' },
  { form: 'sample-lantern-hill-admission', fieldId: 'address', en: 'Address', hi: 'पता' },
  { form: 'sample-lantern-hill-admission', fieldId: 'course', en: 'Course choice', hi: 'पाठ्यक्रम का चयन' },
  { form: 'sample-lantern-hill-admission', fieldId: 'previous-marks', en: 'Previous marks (%)', hi: 'पिछले अंक (%)' },
  { form: 'sample-lantern-hill-admission', fieldId: 'photo', en: 'Photo', hi: 'फ़ोटो' },
  { form: 'sample-lantern-hill-admission', fieldId: 'signature', en: 'Signature', hi: 'हस्ताक्षर' },

  { form: 'sample-moonfield-scholarship', fieldId: 'full-name', en: 'Full name', hi: 'पूरा नाम' },
  { form: 'sample-moonfield-scholarship', fieldId: 'dob', en: 'Date of birth', hi: 'जन्म तिथि' },
  { form: 'sample-moonfield-scholarship', fieldId: 'income-band', en: 'Family income band', hi: 'पारिवारिक आय वर्ग' },
  { form: 'sample-moonfield-scholarship', fieldId: 'course', en: 'Course of study', hi: 'अध्ययन का पाठ्यक्रम' },
  { form: 'sample-moonfield-scholarship', fieldId: 'statement', en: 'Short statement', hi: 'संक्षिप्त कथन' },
  { form: 'sample-moonfield-scholarship', fieldId: 'declaration', en: 'Declaration', hi: 'घोषणा' },
  { form: 'sample-moonfield-scholarship', fieldId: 'signature', en: 'Signature', hi: 'हस्ताक्षर' },

  { form: 'sample-hollowbrook-hostel', fieldId: 'full-name', en: 'Full name', hi: 'पूरा नाम' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'dob', en: 'Date of birth (DD/MM/YYYY)', hi: 'जन्म तिथि (DD/MM/YYYY)' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'id-type', en: 'ID type', hi: 'पहचान पत्र का प्रकार' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'sample-id-number', en: 'Sample ID number', hi: 'नमूना आईडी संख्या' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'address', en: 'Address', hi: 'पता' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'emergency-contact-name', en: 'Emergency contact name', hi: 'आपातकालीन संपर्क का नाम' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'emergency-contact-phone', en: 'Emergency contact phone', hi: 'आपातकालीन संपर्क फ़ोन' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'arrival-date', en: 'Arrival date (YYYY-MM-DD)', hi: 'आगमन तिथि (YYYY-MM-DD)' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'departure-date', en: 'Departure date (D-M-YY)', hi: 'प्रस्थान तिथि (D-M-YY)' },
  { form: 'sample-hollowbrook-hostel', fieldId: 'signature', en: 'Signature', hi: 'हस्ताक्षर' },
];
