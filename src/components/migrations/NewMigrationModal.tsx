import React, { useState, useEffect, useMemo } from 'react'
import { fetchViewMigrations, fetchPreviousATSList, getNextMigrationId } from '../../lib/sheets'
import { postJSON } from '../../lib/apiClient'
import { ZAP_NEW_MIGRATION_URL } from '../../lib/config'
import Toast from '../Toast.jsx'

type NewMigrationModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  existingOwners?: string[]
}

// Static fallback (will be replaced by useAtsOptions hook)
const STATIC_ATS_OPTIONS = [
  'Bullhorn',
  'Greenhouse',
  'Lever',
  'Jobvite',
  'Workday',
  'iCIMS',
  'Other',
]

const DATA_METHOD_OPTIONS = [
  '--PLEASE SELECT--',
  'In-app file upload',
  'Shared SFTP credentials',
  'Other (PLEASE DESCRIBE)',
]

const TIER_OPTIONS = [
  '--PLEASE SELECT--',
  'Free (1)',
  'Standard (2)',
  'High Touch (3)',
  'N/A',
]

const POD_OPTIONS = [
  '--PLEASE SELECT--',
  'pod-1',
  'pod-2',
  'pod-3',
  'pod-4',
  'pod-5',
  'pod-6',
]


export default function NewMigrationModal({ open, onClose, onSuccess, existingOwners = [] }: NewMigrationModalProps) {
  
  const [form, setForm] = useState({
    agencyId: '',
    agencySlug: '',
    customerName: '',
    ownerEmail: '',
    previousATS: '',
    dataMethod: '--PLEASE SELECT--',
    accessInstructions: '',
    additionalDetails: '',
    intakeNotes: '',
    payingUsers: '',
    tier: '--PLEASE SELECT--',
    pod: '--PLEASE SELECT--',
    customerSegment: '',
    churn0Link: '',
    primaryContactName: '',
    primaryContactEmail: '',
    secondaryContactName: '',
    secondaryContactEmail: '',
    tertiaryContactName: '',
    tertiaryContactEmail: '',
    onboardingSpecialistName: '',
    onboardingSpecialistEmail: '',
    secondPassNeeded: '',
    attachments: '',
  })
  const [owners, setOwners] = useState<string[]>(existingOwners)
  const [atsOptions, setAtsOptions] = useState<string[]>([])
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsError, setAtsError] = useState<string | null>(null)
  const [atsSearchQuery, setAtsSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Load ATS options from Google Sheets when modal opens
  // This reads options from the Previous_ATS_List sheet and provides a typeahead experience
  // so users can select from a controlled list of ATS values
  useEffect(() => {
    if (open) {
      setAtsLoading(true)
      setAtsError(null)
      setAtsOptions([])
      setAtsSearchQuery('')
      
      fetchPreviousATSList()
        .then((options) => {
          setAtsOptions(options)
        })
        .catch((e: any) => {
          console.warn('[NewMigration] Failed to load ATS list:', e)
          setAtsError(e.message || 'Couldn\'t load ATS list')
        })
        .finally(() => {
          setAtsLoading(false)
        })
    }
  }, [open])
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.ats-dropdown-container')) {
        setAtsSearchQuery('')
      }
    }
    
    if (open && atsSearchQuery) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, atsSearchQuery])
  
  // Filter ATS options by search query
  const filteredAtsOptions = useMemo(() => {
    if (!atsSearchQuery.trim()) {
      return atsOptions
    }
    const query = atsSearchQuery.toLowerCase()
    return atsOptions.filter((opt) => opt.toLowerCase().includes(query))
  }, [atsOptions, atsSearchQuery])

  // Load owners if not provided
  useEffect(() => {
    if (open && owners.length === 0) {
      fetchViewMigrations()
        .then(({ rows }) => {
          const ownerSet = new Set<string>()
          for (const row of rows || []) {
            const email = (row?.OwnerEmail ?? '').trim()
            if (email && email.includes('@')) {
              ownerSet.add(email)
            }
          }
          setOwners(Array.from(ownerSet).sort((a, b) => a.localeCompare(b)))
        })
        .catch((e) => {
          console.warn('[NewMigration] Failed to load owners:', e)
        })
    }
  }, [open, owners.length])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.agencyId.trim()) {
      newErrors.agencyId = 'Agency ID is required'
    }
    if (!form.agencySlug.trim()) {
      newErrors.agencySlug = 'Agency Slug is required'
    }
    if (!form.customerName.trim()) {
      newErrors.customerName = 'Customer Name is required'
    }
    if (!form.ownerEmail.trim()) {
      newErrors.ownerEmail = 'Please select an owner email'
    }
    if (!form.previousATS.trim()) {
      newErrors.previousATS = 'Previous ATS is required'
    }
    if (atsError) {
      newErrors.previousATS = 'Couldn\'t load ATS list'
    }
    if (!form.payingUsers.trim()) {
      newErrors.payingUsers = 'Number of Paying Users is required'
    } else {
      const num = parseInt(form.payingUsers.trim(), 10)
      if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
        newErrors.payingUsers = 'Must be a positive integer'
      }
    }
    if (form.dataMethod === '--PLEASE SELECT--') {
      newErrors.dataMethod = 'Please select a data method'
    }
    if (form.tier === '--PLEASE SELECT--') {
      newErrors.tier = 'Please select a Migration Tier'
    }
    if (form.pod === '--PLEASE SELECT--') {
      newErrors.pod = 'Please select an Agency Pod'
    }
    if (!form.customerSegment.trim()) {
      newErrors.customerSegment = 'Customer Segment is required'
    }
    if (!form.churn0Link.trim()) {
      newErrors.churn0Link = 'ChurnZero Link is required'
    } else {
      const url = form.churn0Link.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        newErrors.churn0Link = 'Must start with http:// or https://'
      }
    }
    if (!form.primaryContactName.trim()) {
      newErrors.primaryContactName = 'Primary Contact Name is required'
    }
    if (!form.primaryContactEmail.trim() || !form.primaryContactEmail.includes('@')) {
      newErrors.primaryContactEmail = 'Valid primary contact email is required'
    }
    // Secondary contacts are optional, but validate email format if provided
    if (form.secondaryContactEmail.trim() && !form.secondaryContactEmail.includes('@')) {
      newErrors.secondaryContactEmail = 'Valid email format is required'
    }
    // Tertiary contacts are optional, but validate email format if provided
    if (form.tertiaryContactEmail.trim() && !form.tertiaryContactEmail.includes('@')) {
      newErrors.tertiaryContactEmail = 'Valid email format is required'
    }
    // Onboarding Specialist fields are required
    if (!form.onboardingSpecialistName.trim()) {
      newErrors.onboardingSpecialistName = 'Onboarding Specialist Name is required'
    }
    if (!form.onboardingSpecialistEmail.trim()) {
      newErrors.onboardingSpecialistEmail = 'Onboarding Specialist Email is required'
    } else if (!form.onboardingSpecialistEmail.includes('@') || !form.onboardingSpecialistEmail.includes('.')) {
      newErrors.onboardingSpecialistEmail = 'Valid email format is required'
    }
    // Second pass needed is required
    if (!form.secondPassNeeded.trim()) {
      newErrors.secondPassNeeded = 'Please select whether a second pass is needed'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    // Block submit if ATS list failed to load
    if (atsError) {
      setErrors((e) => ({ ...e, previousATS: 'Couldn\'t load ATS list' }))
      return
    }

    if (!validate()) {
      return
    }

    setLoading(true)

    try {
      if (ZAP_NEW_MIGRATION_URL) {
        // Generate the next MigrationID before building the payload
        // This reads MH_View_Migrations to find the max existing ID and increments it
        const migrationId = await getNextMigrationId()
        
        // Primary path: send to Zapier webhook with full payload
        const payload: Record<string, string> = {
          migrationId: migrationId, // Generated MigrationID (e.g., "M-0062") - used by Zapier to create GitHub issue and populate MigrationID column
          agency_id: form.agencyId.trim(),
          agency_slug: form.agencySlug.trim(),
          customer_name: form.customerName.trim(),
          customer_email: form.primaryContactEmail.trim(),
          previous_ats: form.previousATS.trim(),
          tier: form.tier.trim() !== '--PLEASE SELECT--' ? form.tier.trim() : '',
          pod: form.pod.trim() !== '--PLEASE SELECT--' ? form.pod.trim() : '',
          owner: form.ownerEmail.trim(),
          customer_segment: form.customerSegment.trim(),
          churnzero_link: form.churn0Link.trim(),
          primary_contact_name: form.primaryContactName.trim(),
          primary_contact_email: form.primaryContactEmail.trim(),
          secondary_contact_name: form.secondaryContactName.trim(),
          secondary_contact_email: form.secondaryContactEmail.trim(),
          tertiary_contact_name: form.tertiaryContactName.trim(),
          tertiary_contact_email: form.tertiaryContactEmail.trim(),
          intake_notes: form.intakeNotes.trim(),
          data_access_method: form.dataMethod.trim() !== '--PLEASE SELECT--' ? form.dataMethod.trim() : '',
          customer_data_access_instructions: form.accessInstructions.trim(),
          additional_details: form.additionalDetails.trim(),
          number_of_paying_users: form.payingUsers.trim(),
          migration_tier: form.tier.trim() !== '--PLEASE SELECT--' ? form.tier.trim() : '',
          agency_pod: form.pod.trim() !== '--PLEASE SELECT--' ? form.pod.trim() : '',
          onboardingSpecialistName: form.onboardingSpecialistName.trim(), // Required for tracking the Onboarding Specialist responsible for the migration
          onboardingSpecialistEmail: form.onboardingSpecialistEmail.trim(), // Required for tracking the Onboarding Specialist responsible for the migration
          secondPassNeeded: form.secondPassNeeded.trim(),
          attachments: form.attachments.trim(),
        }
        
        try {
          await fetch(ZAP_NEW_MIGRATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'no-cors',
          })
          console.log('[NewMigration] Sent payload to Zapier', payload)
        } catch (error) {
          console.error('[NewMigration] Zapier webhook failed', error)
          // keep existing user-facing error handling
        }
      } else {
        // Fallback: legacy API behavior
        const payload = {
          agencyId: form.agencyId.trim(),
          agencySlug: form.agencySlug.trim(),
          customerName: form.customerName.trim(),
          ownerEmail: form.ownerEmail.trim(),
          previousATS: form.previousATS.trim(),
          dataMethod: form.dataMethod.trim(),
          accessInstructions: form.accessInstructions.trim() || '',
          additionalDetails: form.additionalDetails.trim() || '',
          intakeNotes: form.intakeNotes.trim() || '',
          payingUsers: form.payingUsers.trim(),
          tier: form.tier.trim(),
          pod: form.pod.trim(),
          customerSegment: form.customerSegment.trim(),
          churn0Link: form.churn0Link.trim(),
          primaryContactName: form.primaryContactName.trim(),
          primaryContactEmail: form.primaryContactEmail.trim(),
          secondaryContactName: form.secondaryContactName.trim() || '',
          secondaryContactEmail: form.secondaryContactEmail.trim() || '',
          tertiaryContactName: form.tertiaryContactName.trim() || '',
          tertiaryContactEmail: form.tertiaryContactEmail.trim() || '',
          secondPassNeeded: form.secondPassNeeded.trim(),
          attachments: form.attachments.trim(),
        }
        
        await postJSON('/migrations', payload)
        console.log('[NewMigration] Sent to legacy /api/migrations')
      }
      
      setToast({ message: 'Submitted to Engineering', type: 'success' })
      setTimeout(() => {
        onClose()
        if (onSuccess) onSuccess()
      }, 1500)
    } catch (e: any) {
      console.error('[NewMigration] Submit error', e)
      setSubmitError(e.message || 'Failed to create migration')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    if (errors[field]) {
      setErrors((e) => ({ ...e, [field]: '' }))
    }
  }

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setForm({
        agencyId: '',
        agencySlug: '',
        customerName: '',
        ownerEmail: '',
        previousATS: '',
        dataMethod: '--PLEASE SELECT--',
        accessInstructions: '',
        additionalDetails: '',
        intakeNotes: '',
        payingUsers: '',
        tier: '--PLEASE SELECT--',
        pod: '--PLEASE SELECT--',
        customerSegment: '',
        churn0Link: '',
        primaryContactName: '',
        primaryContactEmail: '',
        secondaryContactName: '',
        secondaryContactEmail: '',
        tertiaryContactName: '',
        tertiaryContactEmail: '',
        onboardingSpecialistName: '',
        onboardingSpecialistEmail: '',
        secondPassNeeded: '',
        attachments: '',
      })
      setAtsSearchQuery('')
      setErrors({})
      setSubmitError(null)
      setToast(null)
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 m-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">New Migration</h3>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 border border-slate-200 hover:bg-slate-50"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="agencyId" className="block text-sm font-medium text-slate-700 mb-1">
                  Agency ID <span className="text-rose-500">*</span>
                </label>
                <input
                  id="agencyId"
                  type="text"
                  value={form.agencyId}
                  onChange={updateField('agencyId')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.agencyId ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.agencyId && <p className="text-xs text-rose-600 mt-1">{errors.agencyId}</p>}
              </div>

              <div>
                <label htmlFor="agencySlug" className="block text-sm font-medium text-slate-700 mb-1">
                  Agency Slug <span className="text-rose-500">*</span>
                </label>
                <input
                  id="agencySlug"
                  type="text"
                  value={form.agencySlug}
                  onChange={updateField('agencySlug')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.agencySlug ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.agencySlug && <p className="text-xs text-rose-600 mt-1">{errors.agencySlug}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-slate-700 mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="customerName"
                type="text"
                value={form.customerName}
                onChange={updateField('customerName')}
                className={`w-full rounded-md border px-3 py-2 text-sm ${errors.customerName ? 'border-rose-500' : 'border-slate-300'}`}
                disabled={loading}
              />
              {errors.customerName && <p className="text-xs text-rose-600 mt-1">{errors.customerName}</p>}
            </div>

            <div>
              <label htmlFor="ownerEmail" className="block text-sm font-medium text-slate-700 mb-1">
                Owner (BTC email) <span className="text-rose-500">*</span>
              </label>
              <select
                id="ownerEmail"
                value={form.ownerEmail}
                onChange={updateField('ownerEmail')}
                className={`w-full rounded-md border px-3 py-2 text-sm ${errors.ownerEmail ? 'border-rose-500' : 'border-slate-300'}`}
                disabled={loading}
              >
                <option value="">-- Select --</option>
                <option value="ahughes@loxo.co">ahughes@loxo.co</option>
                <option value="bilal@loxo.co">bilal@loxo.co</option>
                <option value="lucas@loxo.co">lucas@loxo.co</option>
              </select>
              {errors.ownerEmail && <p className="text-xs text-rose-600 mt-1">{errors.ownerEmail}</p>}
            </div>

            <div>
              <label htmlFor="previousATS" className="block text-sm font-medium text-slate-700 mb-1">
                Previous ATS <span className="text-rose-500">*</span>
              </label>
              {atsLoading ? (
                <div className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-500">
                  Loading...
                </div>
              ) : atsError ? (
                <>
                  <div className="w-full rounded-md border border-rose-500 px-3 py-2 text-sm text-rose-600">
                    Couldn't load ATS list
                  </div>
                  <p className="text-xs text-rose-600 mt-1">{atsError}</p>
                </>
              ) : (
                <div className="relative ats-dropdown-container">
                  {/* Previous ATS autocomplete field - loads options from Previous_ATS_List Google Sheet tab */}
                  <input
                    type="text"
                    value={atsSearchQuery || form.previousATS || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setAtsSearchQuery(val)
                      // Clear selected value when user starts typing
                      if (form.previousATS) {
                        setForm((f) => ({ ...f, previousATS: '' }))
                      }
                    }}
                    onFocus={() => {
                      // If a value is selected, start with empty search to show all options
                      if (form.previousATS && !atsSearchQuery) {
                        setAtsSearchQuery('')
                      }
                    }}
                    placeholder="Type to search Previous ATS options..."
                    className={`w-full rounded-md border px-3 py-2 text-sm ${errors.previousATS ? 'border-rose-500' : 'border-slate-300'}`}
                    disabled={loading}
                  />
                  {/* Show dropdown when user is typing and there are matching options */}
                  {atsSearchQuery && filteredAtsOptions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredAtsOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, previousATS: opt }))
                            setAtsSearchQuery('')
                            if (errors.previousATS) {
                              setErrors((e) => ({ ...e, previousATS: '' }))
                            }
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {errors.previousATS && <p className="text-xs text-rose-600 mt-1">{errors.previousATS}</p>}
            </div>

            <div>
              <label htmlFor="dataMethod" className="block text-sm font-medium text-slate-700 mb-1">
                How did they provide us their data? <span className="text-rose-500">*</span>
              </label>
              <select
                id="dataMethod"
                value={form.dataMethod}
                onChange={updateField('dataMethod')}
                className={`w-full rounded-md border px-3 py-2 text-sm ${errors.dataMethod ? 'border-rose-500' : 'border-slate-300'}`}
                disabled={loading}
              >
                {DATA_METHOD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {errors.dataMethod && <p className="text-xs text-rose-600 mt-1">{errors.dataMethod}</p>}
            </div>

            <div>
              <label htmlFor="accessInstructions" className="block text-sm font-medium text-slate-700 mb-1">
                Customer Data Access Instructions <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="accessInstructions"
                value={form.accessInstructions}
                onChange={updateField('accessInstructions')}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="additionalDetails" className="block text-sm font-medium text-slate-700 mb-1">
                Additional Details <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="additionalDetails"
                value={form.additionalDetails}
                onChange={updateField('additionalDetails')}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="payingUsers" className="block text-sm font-medium text-slate-700 mb-1">
                  Number of Paying Users <span className="text-rose-500">*</span>
                </label>
                <input
                  id="payingUsers"
                  type="text"
                  value={form.payingUsers}
                  onChange={updateField('payingUsers')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.payingUsers ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                  placeholder="e.g., 100"
                />
                {errors.payingUsers && <p className="text-xs text-rose-600 mt-1">{errors.payingUsers}</p>}
              </div>

              <div>
                <label htmlFor="tier" className="block text-sm font-medium text-slate-700 mb-1">
                  Migration Tier Paid For <span className="text-rose-500">*</span>
                </label>
                <select
                  id="tier"
                  value={form.tier}
                  onChange={updateField('tier')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.tier ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                >
                  {TIER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {errors.tier && <p className="text-xs text-rose-600 mt-1">{errors.tier}</p>}
              </div>

              <div>
                <label htmlFor="pod" className="block text-sm font-medium text-slate-700 mb-1">
                  Agency Pod <span className="text-rose-500">*</span>
                </label>
                <select
                  id="pod"
                  value={form.pod}
                  onChange={updateField('pod')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.pod ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                >
                  {POD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {errors.pod && <p className="text-xs text-rose-600 mt-1">{errors.pod}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customerSegment" className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Segment <span className="text-rose-500">*</span>
                </label>
                <input
                  id="customerSegment"
                  type="text"
                  value={form.customerSegment}
                  onChange={updateField('customerSegment')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.customerSegment ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.customerSegment && <p className="text-xs text-rose-600 mt-1">{errors.customerSegment}</p>}
              </div>

              <div>
                <label htmlFor="churn0Link" className="block text-sm font-medium text-slate-700 mb-1">
                  ChurnZero Link <span className="text-rose-500">*</span>
                </label>
                <input
                  id="churn0Link"
                  type="text"
                  value={form.churn0Link}
                  onChange={updateField('churn0Link')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.churn0Link ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                  placeholder="https://..."
                />
                {errors.churn0Link && <p className="text-xs text-rose-600 mt-1">{errors.churn0Link}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="primaryContactName" className="block text-sm font-medium text-slate-700 mb-1">
                  Primary Contact Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="primaryContactName"
                  type="text"
                  value={form.primaryContactName}
                  onChange={updateField('primaryContactName')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.primaryContactName ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.primaryContactName && <p className="text-xs text-rose-600 mt-1">{errors.primaryContactName}</p>}
              </div>

              <div>
                <label htmlFor="primaryContactEmail" className="block text-sm font-medium text-slate-700 mb-1">
                  Primary Contact Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="primaryContactEmail"
                  type="email"
                  value={form.primaryContactEmail}
                  onChange={updateField('primaryContactEmail')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.primaryContactEmail ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.primaryContactEmail && <p className="text-xs text-rose-600 mt-1">{errors.primaryContactEmail}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="secondaryContactName" className="block text-sm font-medium text-slate-700 mb-1">
                  Secondary Contact Name <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="secondaryContactName"
                  type="text"
                  value={form.secondaryContactName}
                  onChange={updateField('secondaryContactName')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="secondaryContactEmail" className="block text-sm font-medium text-slate-700 mb-1">
                  Secondary Contact Email <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="secondaryContactEmail"
                  type="email"
                  value={form.secondaryContactEmail}
                  onChange={updateField('secondaryContactEmail')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.secondaryContactEmail ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.secondaryContactEmail && <p className="text-xs text-rose-600 mt-1">{errors.secondaryContactEmail}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tertiaryContactName" className="block text-sm font-medium text-slate-700 mb-1">
                  Tertiary Contact Name <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="tertiaryContactName"
                  type="text"
                  value={form.tertiaryContactName}
                  onChange={updateField('tertiaryContactName')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="tertiaryContactEmail" className="block text-sm font-medium text-slate-700 mb-1">
                  Tertiary Contact Email <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="tertiaryContactEmail"
                  type="email"
                  value={form.tertiaryContactEmail}
                  onChange={updateField('tertiaryContactEmail')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.tertiaryContactEmail ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.tertiaryContactEmail && <p className="text-xs text-rose-600 mt-1">{errors.tertiaryContactEmail}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="intakeNotes" className="block text-sm font-medium text-slate-700 mb-1">
                Intake Notes <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="intakeNotes"
                value={form.intakeNotes}
                onChange={updateField('intakeNotes')}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="onboardingSpecialistName" className="block text-sm font-medium text-slate-700 mb-1">
                  Onboarding Specialist Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="onboardingSpecialistName"
                  type="text"
                  value={form.onboardingSpecialistName}
                  onChange={updateField('onboardingSpecialistName')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.onboardingSpecialistName ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.onboardingSpecialistName && <p className="text-xs text-rose-600 mt-1">{errors.onboardingSpecialistName}</p>}
              </div>

              <div>
                <label htmlFor="onboardingSpecialistEmail" className="block text-sm font-medium text-slate-700 mb-1">
                  Onboarding Specialist Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="onboardingSpecialistEmail"
                  type="email"
                  value={form.onboardingSpecialistEmail}
                  onChange={updateField('onboardingSpecialistEmail')}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.onboardingSpecialistEmail ? 'border-rose-500' : 'border-slate-300'}`}
                  disabled={loading}
                />
                {errors.onboardingSpecialistEmail && <p className="text-xs text-rose-600 mt-1">{errors.onboardingSpecialistEmail}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="secondPassNeeded" className="block text-sm font-medium text-slate-700 mb-1">
                Second pass needed? <span className="text-rose-500">*</span>
              </label>
              <select
                id="secondPassNeeded"
                value={form.secondPassNeeded}
                onChange={updateField('secondPassNeeded')}
                className={`w-full rounded-md border px-3 py-2 text-sm ${errors.secondPassNeeded ? 'border-rose-500' : 'border-slate-300'}`}
                disabled={loading}
              >
                <option value="">-- Select --</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
              {errors.secondPassNeeded && <p className="text-xs text-rose-600 mt-1">{errors.secondPassNeeded}</p>}
            </div>

            <div>
              <label htmlFor="attachments" className="block text-sm font-medium text-slate-700 mb-1">
                Attachments <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="attachments"
                value={form.attachments}
                onChange={updateField('attachments')}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={loading}
                placeholder="Paste one or more links, separated by commas or new lines"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading || !!atsError || atsLoading}
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? 'Creating...' : 'Create Migration'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}

