import { insertDailyLogSchema, insertUserTargetsSchema, insertInterventionSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUSPICIOUS_SQL_RE = /\b(drop|delete|insert|update|union|select)\b/i;
const SUSPICIOUS_XSS_RE = /(<\s*script\b|javascript:|onerror\s*=|onload\s*=|<\s*img\b|<\s*svg\b|<\s*iframe\b|<\s*body\b)/i;

function bad(msg: string): never {
  throw new Error(`Validation error: ${msg}`);
}

export function validateDailyLogPayload(payload: any) {
  // Use the generated schema but omit flag fields (they are computed server-side)
  const schema = insertDailyLogSchema.omit({
    sleepFlag: true,
    rhrFlag: true,
    hrvFlag: true,
    proteinFlag: true,
    gutFlag: true,
    sunFlag: true,
    exerciseFlag: true,
    symptomFlag: true,
  });

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    bad(fromZodError(parsed.error).toString());
  }

  const data = parsed.data as any;

  // Date format
  if (!DATE_RE.test(data.date)) bad('`date` must be YYYY-MM-DD');
  {
    // Ensure it's a real calendar date (e.g., reject 9999-99-99, 2024-13-45, etc.)
    const d = new Date(`${data.date}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) bad('`date` must be a valid calendar date');
    // Guard against Date() normalizing invalid inputs (e.g., 2024-02-31 -> 2024-03-02)
    if (d.toISOString().slice(0, 10) !== data.date) bad('`date` must be a valid calendar date');
  }

  // Numeric ranges
  if (typeof data.sleep !== 'number' || data.sleep < 0 || data.sleep > 24) bad('`sleep` must be a number between 0 and 24');
  if (!Number.isInteger(data.rhr) || data.rhr <= 0 || data.rhr >= 300) bad('`rhr` must be a positive reasonable BPM');
  if (!Number.isFinite(data.hrv) || typeof data.hrv !== 'number' || data.hrv < 0) bad('`hrv` must be a non-negative number');

  if (!Number.isInteger(data.protein) || data.protein < 0 || data.protein > 5000) bad('`protein` must be an integer between 0 and 5000');
  if (!Number.isInteger(data.gut) || data.gut < 1 || data.gut > 5) bad('`gut` must be an integer between 1 and 5');
  if (!Number.isInteger(data.sun) || data.sun < 1 || data.sun > 5) bad('`sun` must be an integer between 1 and 5');
  if (!Number.isInteger(data.exercise) || data.exercise < 1 || data.exercise > 5) bad('`exercise` must be an integer between 1 and 5');

  if (!Number.isInteger(data.symptomScore) || data.symptomScore < 0 || data.symptomScore > 5) bad('`symptomScore` must be integer 0-5');

  if (data.symptomName != null) {
    if (typeof data.symptomName !== 'string') bad('`symptomName` must be a string');
    const symptomName = data.symptomName.trim();
    if (symptomName.length > 200) bad('`symptomName` must be at most 200 characters');
    if (SUSPICIOUS_SQL_RE.test(symptomName)) bad('`symptomName` contains disallowed content');
    if (SUSPICIOUS_XSS_RE.test(symptomName)) bad('`symptomName` contains disallowed content');
  }

  // Everything okay
  return data;
}

export function validateUserTargetsPayload(payload: any) {
  const schema = insertUserTargetsSchema.partial();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) bad(fromZodError(parsed.error).toString());

  const data = parsed.data as any;

  if (data.proteinTarget !== undefined) {
    if (!Number.isInteger(data.proteinTarget) || data.proteinTarget < 0 || data.proteinTarget > 5000) bad('`proteinTarget` must be integer 0-5000');
  }
  if (data.gutTarget !== undefined) {
    if (!Number.isInteger(data.gutTarget) || data.gutTarget < 1 || data.gutTarget > 5) bad('`gutTarget` must be integer 1-5');
  }
  if (data.sunTarget !== undefined) {
    if (!Number.isInteger(data.sunTarget) || data.sunTarget < 1 || data.sunTarget > 5) bad('`sunTarget` must be integer 1-5');
  }
  if (data.exerciseTarget !== undefined) {
    if (!Number.isInteger(data.exerciseTarget) || data.exerciseTarget < 1 || data.exerciseTarget > 5) bad('`exerciseTarget` must be integer 1-5');
  }

  return data;
}

export function validateInterventionPayload(payload: any) {
  // Allow ISO string dates in payload by coercing them to Date objects before schema parsing
  const coerced = {
    ...payload,
    startDate: payload?.startDate && typeof payload.startDate === 'string' ? new Date(payload.startDate) : payload?.startDate,
    endDate: payload?.endDate && typeof payload.endDate === 'string' ? new Date(payload.endDate) : payload?.endDate,
  };

  const parsed = insertInterventionSchema.safeParse(coerced);
  if (!parsed.success) bad(fromZodError(parsed.error).toString());

  const data = parsed.data as any;

  // startDate/endDate should be valid dates
  if (isNaN(Date.parse(String(data.startDate)))) bad('`startDate` must be a valid date');
  if (isNaN(Date.parse(String(data.endDate)))) bad('`endDate` must be a valid date');

  return data;
}

export default {
  validateDailyLogPayload,
  validateUserTargetsPayload,
  validateInterventionPayload,
};
