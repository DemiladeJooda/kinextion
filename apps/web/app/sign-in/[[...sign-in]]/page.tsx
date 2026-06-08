import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main
      className="relative min-h-screen flex items-center justify-center"
      style={{ background: "#07101E" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,214,143,0.12) 0%, rgba(168,85,247,0.06) 50%, transparent 70%)",
        }}
      />
      <div className="relative z-10">
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#00D68F",
              colorBackground: "#0C1728",
              colorText: "#F1F5F9",
              colorTextSecondary: "#94A3B8",
              colorInputBackground: "rgba(255,255,255,0.06)",
              colorInputText: "#F1F5F9",
              borderRadius: "12px",
            },
            elements: {
              card: "shadow-2xl border border-white/[0.08] backdrop-blur-xl",
              headerTitle: "text-white font-bold",
              headerSubtitle: "text-slate-400",
              socialButtonsBlockButton: "border border-white/[0.10] text-slate-300 hover:bg-white/[0.06]",
              formButtonPrimary: "bg-aurora-green text-space-deep font-bold hover:opacity-90",
              footerActionLink: "text-aurora-green hover:opacity-80",
            },
          }}
        />
      </div>
    </main>
  );
}
