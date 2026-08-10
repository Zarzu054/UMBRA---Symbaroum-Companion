import { useEffect, useRef, useState } from "react";
import { useAuthController } from "./controllers/authController";
import { AuthGatewayView, ForcedPasswordChangeView } from "./views/AuthGatewayView";
import { CharacterDashboardView } from "./views/CharacterDashboardView";
import { SuperAdminDashboardView } from "./views/SuperAdminDashboardView";
import { PdfPageViewer } from "./components/PdfPageViewer";
import { getPdfViewerRequest, type PdfViewerRequest } from "./services/pdfViewer";

export function App() {
  const pdfRequest = getPdfViewerRequest(window.location.search);
  if (pdfRequest) {
    return <PdfPageViewer source={pdfRequest.source} initialPage={pdfRequest.page} />;
  }

  return <AppWithPdfOverlay />;
}

function AppWithPdfOverlay() {
  const [overlayRequest, setOverlayRequest] = useState<PdfViewerRequest | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target) return;

      let url: URL;
      try {
        url = new URL(target.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const request = getPdfViewerRequest(url.search);
      if (!request) return;

      event.preventDefault();
      openerRef.current = target;
      window.history.pushState({ ...(window.history.state ?? {}), umbraPdfOverlay: true }, "", window.location.href);
      setOverlayRequest(request);
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    if (!overlayRequest) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [overlayRequest]);

  useEffect(() => {
    const onPopState = () => {
      if (!overlayRequest) return;
      setOverlayRequest(null);
      window.setTimeout(() => openerRef.current?.focus(), 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [overlayRequest]);

  const closeOverlay = () => {
    if (window.history.state?.umbraPdfOverlay) {
      window.history.back();
      return;
    }
    setOverlayRequest(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };

  return (
    <>
      <AuthenticatedApp />
      {overlayRequest ? (
        <div className="pdf-viewer-overlay" role="dialog" aria-modal="true" aria-label="Visor de referencia PDF">
          <PdfPageViewer source={overlayRequest.source} initialPage={overlayRequest.page} onClose={closeOverlay} />
        </div>
      ) : null}
    </>
  );
}

function AuthenticatedApp() {
  const auth = useAuthController();

  if (auth.isBootstrapping) {
    return (
      <main className="page">
        <section className="panel">
          <p>Cargando sesión...</p>
        </section>
      </main>
    );
  }

  if (!auth.auth) {
    return (
      <AuthGatewayView
        isSubmitting={auth.isSubmitting}
        error={auth.error}
        onLogin={auth.login}
        onRequestPasswordReset={auth.sendPasswordReset}
        onResetPassword={auth.confirmPasswordReset}
      />
    );
  }

  if (auth.auth.user.mustChangePassword) {
    return (
      <ForcedPasswordChangeView
        email={auth.auth.user.email}
        isSubmitting={auth.isSubmitting}
        error={auth.error}
        onSubmit={(input) => auth.rotatePassword(input.currentPassword, input.newPassword)}
        onLogout={auth.logout}
      />
    );
  }

  if (auth.auth.user.role === "superadmin") {
    return (
      <SuperAdminDashboardView
        user={auth.auth.user}
        ensureAccessToken={auth.ensureAccessToken}
        onLogout={auth.logout}
      />
    );
  }

  return (
    <CharacterDashboardView
      user={auth.auth.user}
      ensureAccessToken={auth.ensureAccessToken}
      onLogout={auth.logout}
    />
  );
}
