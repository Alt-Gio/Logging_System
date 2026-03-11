// src/lib/validation.ts — shared Zod schemas
import { z } from 'zod'

export const LogCreateSchema = z.object({
  // Filipino name support: allows accented chars, ñ, Ñ, Jr., Sr., spaces, hyphens, apostrophes
  fullName:             z.string().min(2).max(120).regex(/^[a-zA-ZÀ-ÖØ-öø-ÿñÑ\s.\-']+$/, 'Name contains invalid characters'),
  agency:               z.string().min(1).max(200),
  purpose:              z.string().min(2).max(500),
  equipmentUsed:        z.array(z.string()).min(1, 'Select at least one service'),
  pcId:                 z.string().cuid().nullable().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  // Photo must be a valid data URI of an image (prevents storing arbitrary blobs)
  photoDataUrl:         z.string().max(2_000_000).regex(/^data:image\/(jpeg|jpg|png|webp|gif);base64,/).nullable().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  plannedDurationHours: z.number().min(0.25).max(8),
  serviceType:          z.enum(['SELF_SERVICE', 'STAFF_ASSISTED']).default('SELF_SERVICE'),
  staffNotes:           z.string().max(500).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  satisfactionRating:   z.number().int().min(1).max(5).nullable().optional(),
})

export const LogUpdateSchema = z.object({
  fullName:             z.string().min(2).max(120).regex(/^[a-zA-ZÀ-ÖØ-öø-ÿñÑ\s.\-']+$/).optional(),
  agency:               z.string().min(1).max(200).optional(),
  purpose:              z.string().min(2).max(500).optional(),
  equipmentUsed:        z.array(z.string()).optional(),
  plannedDurationHours: z.number().min(0.25).max(8).optional(),
  timeIn:               z.string().datetime().optional(),
  timeOut:              z.string().datetime().nullable().optional(),
  archived:             z.boolean().optional(),
  staffNotes:           z.string().max(500).nullable().optional(),
  serviceType:          z.enum(['SELF_SERVICE', 'STAFF_ASSISTED']).optional(),
  satisfactionRating:   z.number().int().min(1).max(5).nullable().optional(),
})

export const PcCreateSchema = z.object({
  name:      z.string().min(1).max(50),
  ipAddress: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'Invalid IP format'),
  location:  z.string().max(100).optional(),
})

export const PcUpdateSchema = z.object({
  name:      z.string().min(1).max(50).optional(),
  ipAddress: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).optional(),
  location:  z.string().max(100).nullable().optional(),
  status:    z.enum(['ONLINE','OFFLINE','IN_USE','MAINTENANCE']).optional(),
  ssid:      z.string().max(64).nullable().optional(),
  specs:     z.string().max(500).nullable().optional(),
  icon:      z.string().max(10).nullable().optional(),
  gridCol:   z.number().int().min(1).max(12).optional(),
  gridRow:   z.number().int().min(1).max(12).optional(),
})

export const CameraSchema = z.object({
  name:  z.string().min(1).max(100),
  // Only http/https to prevent SSRF via internal protocol handlers
  url:   z.string().url().regex(/^https?:\/\//, 'URL must use http or https'),
  type:  z.enum(['MJPEG','SNAPSHOT','HLS','RTSP_PROXY']).default('MJPEG'),
  notes: z.string().max(300).optional(),
})

export const SettingsSchema = z.object({
  wifiSsid:         z.string().max(64).optional(),
  wifiPassword:     z.string().max(64).optional(),
  wifiNote:         z.string().max(200).optional(),
  accessCode:       z.string().min(4).max(10).optional(),
  officeOpen:       z.string().regex(/^\d{2}:\d{2}$/).optional(),
  officeClose:      z.string().regex(/^\d{2}:\d{2}$/).optional(),
  bgImageUrl:            z.string().max(5_000_000).optional(),   // custom background — URL or base64 data URI
  interactiveBannerUrl:  z.string().max(5_000_000).optional(),   // interactive banner — URL or base64 data URI
  googleSheetId:         z.string().max(200).optional(),
  googleServiceKey:      z.string().max(8000).optional(),
})

export const AnnouncementSchema = z.object({
  title:     z.string().min(1).max(200),
  body:      z.string().min(1).max(2000),
  type:      z.enum(['INFO','WARNING','MAINTENANCE','HOLIDAY']).default('INFO'),
  dateStart: z.string().nullable().optional(),
  dateEnd:   z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  active:    z.boolean().default(true),
})
