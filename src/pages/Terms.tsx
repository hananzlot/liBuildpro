import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <Button variant="ghost" asChild className="mb-8">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this application, you accept and agree to be bound by the terms
              and provisions of this agreement. If you do not agree to these terms, please do not
              use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">2. Use of Service</h2>
            <p>
              You agree to use this service only for lawful purposes and in accordance with these
              Terms. You agree not to use the service in any way that violates any applicable
              federal, state, local, or international law or regulation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">3. User Accounts</h2>
            <p>
              When you create an account with us, you must provide accurate, complete, and current
              information. You are responsible for safeguarding the password and for all activities
              that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">4. Intellectual Property</h2>
            <p>
              The service and its original content, features, and functionality are and will remain
              the exclusive property of the company and its licensors. The service is protected by
              copyright, trademark, and other laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">5. Limitation of Liability</h2>
            <p>
              In no event shall the company, nor its directors, employees, partners, agents,
              suppliers, or affiliates, be liable for any indirect, incidental, special,
              consequential, or punitive damages resulting from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. If a revision is
              material, we will try to provide at least 30 days' notice prior to any new terms
              taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">7. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
