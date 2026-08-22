import { AnonymousReportForm } from '@/components/anonymous-report-form'
import Link from 'next/link'
import Image from 'next/image'
import { Check, FileText, Home, LockKeyhole, MessageCircleMore, Paperclip } from 'lucide-react'

export const metadata = {
  title: 'Submit Feedback or Report - Abhitech Speak Up',
  description: 'Share employee feedback, suggestions, concerns, complaints, or suspected misconduct securely.',
}

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-90">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-Abhitech-WKYuLp4lUYbxjEWZoDP9cQw60WckgV.webp"
              alt="Abhitech"
              width={40}
              height={40}
              className="h-8 w-auto sm:h-10"
            />
            <div className="hidden sm:block">
              <span className="text-lg font-bold text-green-900">Abhitech</span>
              <p className="text-xs text-green-600">Speak Up</p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-green-700 sm:text-base">
            <Home className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Back Home</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_14px_40px_-24px_rgba(5,150,105,0.35)]">
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 shadow-sm shadow-emerald-200">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Abhitech Speak Up</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">What would you like to share?</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Submit feedback, an idea, a workplace concern, or a formal report—choose the category that fits best.</p>
              </div>
            </div>
          </div>

          <div className="grid border-t border-slate-100 bg-slate-50/70 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
            <div className="flex items-center gap-3 px-6 py-4 sm:px-5">
              <LockKeyhole className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <p className="text-sm text-slate-600"><strong className="font-semibold text-slate-900">No identity needed</strong><br />Submit freely and securely</p>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4 sm:border-t-0 sm:px-5">
              <Paperclip className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <p className="text-sm text-slate-600"><strong className="font-semibold text-slate-900">Add evidence</strong><br />Images or PDF, if available</p>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4 sm:border-t-0 sm:px-5">
              <MessageCircleMore className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <p className="text-sm text-slate-600"><strong className="font-semibold text-slate-900">Track & reply</strong><br />Keep your tracking code</p>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-6 py-3 text-sm text-emerald-900 sm:px-8">
            <Check className="h-4 w-4 flex-shrink-0" />
            <p>There is no wrong type of submission—simply choose a category and tell us what matters.</p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.25)] sm:p-8">
          <AnonymousReportForm />
        </section>

        <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">Good to Know</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-gray-900">Can I report anonymously?</h3>
              <p className="text-sm leading-relaxed text-gray-600">Yes. This form does not ask for your name or contact information.</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-gray-900">How do I track my report?</h3>
              <p className="text-sm leading-relaxed text-gray-600">Save the tracking code shown after submission. It lets you view status, read messages, and reply to the review team.</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-gray-900">What evidence can I attach?</h3>
              <p className="text-sm leading-relaxed text-gray-600">You can attach up to three files. JPG, PNG, or WEBP images can be up to 3 MB; PDF files up to 2 MB.</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-gray-900">What happens after submission?</h3>
              <p className="text-sm leading-relaxed text-gray-600">The review team assesses the report, updates its status, and may request more information through the tracking page.</p>
            </div>
          </div>
        </section>

        <Link href="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-green-700 transition hover:text-green-800 sm:text-base">
          ← Back to Home
        </Link>
      </div>
    </main>
  )
}
