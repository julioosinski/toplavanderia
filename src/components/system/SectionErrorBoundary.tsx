import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface SectionErrorBoundaryProps {
  children: ReactNode;
  title?: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || "Erro desconhecido" };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error("[SectionErrorBoundary] render error:", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {this.props.title || "Erro ao renderizar esta seção de configurações."}
              {this.state.errorMessage ? ` Detalhe: ${this.state.errorMessage}` : ""}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="outline"
            onClick={() => this.setState({ hasError: false, errorMessage: null })}
          >
            Tentar carregar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
