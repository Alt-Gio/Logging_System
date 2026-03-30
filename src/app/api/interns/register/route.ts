export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

// Public POST — creates a new intern profile from the registration form.
// Documents are stored by storageId and are only accessible to admins.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      fullName, school, schoolId, course, email, phone,
      sex, age, civilStatus, isIndigenous, isPWD, isSoloParent,
      requiredHours, officeAssignment, supervisor, department,
      startDate, endDate, onboardingDate, estimatedCompletion,
      photoUrl, photoStorageId,
      doc2x2StorageId, docResumeStorageId, docApplicationStorageId,
      docEndorsementStorageId, docMedicalStorageId, docWfhStorageId,
      docWorkPlanStorageId, docNdaStorageId, docNotesStorageId,
    } = body

    if (!fullName || !school || !course) {
      return NextResponse.json({ error: 'fullName, school, and course are required' }, { status: 400 })
    }

    const convex = getConvexClient()

    const id = await convex.mutation(api.interns.create, {
      fullName:            fullName.trim(),
      school:              school.trim(),
      schoolId:            schoolId  ? schoolId  as Id<'schools'>  : undefined,
      course:              course.trim(),
      department:          department         || undefined,
      supervisor:          supervisor         || undefined,
      startDate:           startDate          ? new Date(startDate).getTime()           : Date.now(),
      endDate:             endDate            ? new Date(endDate).getTime()             : Date.now() + 180 * 86400000,
      requiredHours:       requiredHours      ? parseInt(String(requiredHours), 10)     : 486,
      status:              'ACTIVE' as const,
      email:               email              || undefined,
      phone:               phone              || undefined,
      photoUrl:            photoUrl           || undefined,
      photoStorageId:      photoStorageId     || undefined,
      sex:                 sex === 'M' || sex === 'F' ? sex : undefined,
      age:                 age                ? parseInt(String(age), 10)               : undefined,
      civilStatus:         civilStatus        || undefined,
      isIndigenous:        isIndigenous       || undefined,
      isPWD:               isPWD              || undefined,
      isSoloParent:        isSoloParent       || undefined,
      officeAssignment:    officeAssignment   || undefined,
      onboardingDate:      onboardingDate     ? new Date(onboardingDate).getTime()      : undefined,
      estimatedCompletion: estimatedCompletion? new Date(estimatedCompletion).getTime() : undefined,
    })

    // Patch document storageIds separately (not in create to keep it clean)
    const docPatch: Record<string, string> = {}
    if (doc2x2StorageId)         docPatch.doc2x2StorageId         = doc2x2StorageId
    if (docResumeStorageId)      docPatch.docResumeStorageId      = docResumeStorageId
    if (docApplicationStorageId) docPatch.docApplicationStorageId = docApplicationStorageId
    if (docEndorsementStorageId) docPatch.docEndorsementStorageId = docEndorsementStorageId
    if (docMedicalStorageId)     docPatch.docMedicalStorageId     = docMedicalStorageId
    if (docWfhStorageId)         docPatch.docWfhStorageId         = docWfhStorageId
    if (docWorkPlanStorageId)    docPatch.docWorkPlanStorageId    = docWorkPlanStorageId
    if (docNdaStorageId)         docPatch.docNdaStorageId         = docNdaStorageId
    if (docNotesStorageId)       docPatch.docNotesStorageId       = docNotesStorageId

    if (Object.keys(docPatch).length > 0) {
      await convex.mutation(api.interns.update, { id, ...docPatch })
    }

    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (e) {
    console.error('[interns/register]', e)
    return NextResponse.json({ error: 'Registration failed', details: String(e) }, { status: 500 })
  }
}
