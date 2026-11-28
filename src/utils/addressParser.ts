import { z } from 'zod';
import { ParticipantAddress } from '../types/secretSanta';

export const participantAddressSchema = z.object({
  line1: z.string().trim().min(3, 'Please enter your flat, house, or street address').max(200),
  line2: z.string().trim().max(200),
  landmark: z.string().trim().max(120),
  city: z.string().trim().min(2, 'Please enter your city').max(80),
  state: z.string().trim().min(2, 'Please enter your state').max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\s-]{4,12}$/, 'Enter a valid PIN / Postal code (e.g. 122011)'),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine(
      (val) => val === '' || /^[+]?[0-9\s()-]{8,18}$/.test(val),
      'Enter a valid delivery phone number or leave blank'
    ),
});

export const participantFormSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(100),
  address: participantAddressSchema,
  hobbies: z
    .array(z.string().trim().min(1).max(40))
    .min(1, 'Pick at least 1 hobby clue for your Secret Santa!')
    .max(5, 'Whoa! Santa only has room for 5 clues!'),
});

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'New Delhi',
  'Chandigarh',
  'Puducherry',
  'Jammu and Kashmir',
  'Ladakh',
];

const MAJOR_CITIES: Record<string, string> = {
  gurugram: 'Haryana',
  gurgaon: 'Haryana',
  noida: 'Uttar Pradesh',
  'greater noida': 'Uttar Pradesh',
  ghaziabad: 'Uttar Pradesh',
  faridabad: 'Haryana',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  bengaluru: 'Karnataka',
  bangalore: 'Karnataka',
  mumbai: 'Maharashtra',
  pune: 'Maharashtra',
  thane: 'Maharashtra',
  'navi mumbai': 'Maharashtra',
  hyderabad: 'Telangana',
  chennai: 'Tamil Nadu',
  kolkata: 'West Bengal',
  jaipur: 'Rajasthan',
  ahmedabad: 'Gujarat',
  surat: 'Gujarat',
  chandigarh: 'Chandigarh',
  indore: 'Madhya Pradesh',
  lucknow: 'Uttar Pradesh',
  kochi: 'Kerala',
  bhopal: 'Madhya Pradesh',
  nagpur: 'Maharashtra',
  vadodara: 'Gujarat',
  coimbatore: 'Tamil Nadu',
};

/**
 * Parses a pasted Indian delivery address copied from Blinkit, Amazon, Zomato, or Flipkart
 * into structured editable fields.
 */
export function parsePastedIndianAddress(rawText: string): Partial<ParticipantAddress> & { detectedName?: string } {
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .trim();

  if (!cleaned) return {};

  let working = cleaned;
  let phone = '';
  let postalCode = '';
  let state = '';
  let city = '';
  let landmark = '';

  // Extract Indian mobile/phone number (+91 or 10 digits starting with 6-9)
  const phoneMatch = working.match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/);
  if (phoneMatch) {
    phone = phoneMatch[0].trim();
    working = working.replace(phoneMatch[0], ' ');
  }

  // Extract 6-digit Indian PIN code
  const pinMatch = working.match(/\b([1-9]\d{5})\b/);
  if (pinMatch) {
    postalCode = pinMatch[1];
    working = working.replace(pinMatch[0], ' ');
  }

  // Remove trailing "India"
  working = working.replace(/\bIndia\b/gi, ' ');

  // Detect Indian State
  for (const st of INDIAN_STATES) {
    const regex = new RegExp(`\\b${st}\\b`, 'i');
    if (regex.test(working)) {
      state = st === 'New Delhi' ? 'Delhi' : st;
      working = working.replace(regex, ' ');
      break;
    }
  }

  // Detect major Indian City
  for (const [cityKey, mappedState] of Object.entries(MAJOR_CITIES)) {
    const regex = new RegExp(`\\b${cityKey}\\b`, 'i');
    if (regex.test(working)) {
      city = cityKey
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (!state) state = mappedState;
      working = working.replace(regex, ' ');
      break;
    }
  }

  // Detect Landmark
  const landmarkMatch = working.match(/\b(?:near|opp\.?|opposite|behind|beside|next to|landmark[:\s]*)\s+([^,\n]+)/i);
  if (landmarkMatch) {
    landmark = landmarkMatch[0].replace(/^landmark[:\s]*/i, '').trim();
    working = working.replace(landmarkMatch[0], ' ');
  }

  // Split remaining parts into Line 1 and Line 2
  const parts = working
    .split(/[\n,]+/)
    .map((p) => p.replace(/^[\s\-–:]+|[\s\-–:]+$/g, '').trim())
    .filter((p) => p.length > 0 && !/^(phone|mobile|mob|pin|pincode|address|home|work|office)$/i.test(p));

  // If city wasn't in our list, guess from last remaining segment if we have >= 2 segments
  if (!city && parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (last.length <= 30 && /^[A-Za-z\s]+$/.test(last)) {
      city = parts.pop() || '';
    }
  }

  const line1 = parts.slice(0, Math.max(1, Math.ceil(parts.length / 2))).join(', ');
  const line2 = parts.slice(Math.max(1, Math.ceil(parts.length / 2))).join(', ');

  return {
    line1: line1.slice(0, 200),
    line2: line2.slice(0, 200),
    landmark: landmark.slice(0, 120),
    city: city.slice(0, 80),
    state: state.slice(0, 80),
    postalCode: postalCode.slice(0, 12),
    phone: phone.slice(0, 20),
  };
}

export function formatFullAddress(addr: ParticipantAddress): string {
  return [
    addr.line1,
    addr.line2,
    addr.landmark ? `Landmark: ${addr.landmark}` : '',
    [addr.city, addr.state].filter(Boolean).join(', '),
    addr.postalCode ? `PIN: ${addr.postalCode}` : '',
    addr.phone ? `Phone: ${addr.phone}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
