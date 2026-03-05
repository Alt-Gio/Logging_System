// src/lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

// Upload a base64 data URL → returns public Cloudinary URL
// Falls back to null if Cloudinary is not configured (local dev without keys)
export async function uploadPhoto(dataUrl: string, logId: string): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    // Cloudinary not configured — return the dataUrl as-is (dev mode)
    return dataUrl
  }
  try {
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder:         'dict-dtc/clients',
      public_id:      `log_${logId}`,
      overwrite:      true,
      transformation: [
        { width: 320, height: 320, crop: 'fill', gravity: 'face' },
        { quality: 'auto:low', fetch_format: 'auto' },
      ],
    })
    return result.secure_url
  } catch (err) {
    console.error('[Cloudinary] upload failed:', err)
    return dataUrl // fallback to base64 if upload fails
  }
}

// Delete a photo by public_id
export async function deletePhoto(logId: string) {
  try {
    await cloudinary.uploader.destroy(`dict-dtc/clients/log_${logId}`)
  } catch {}
}
