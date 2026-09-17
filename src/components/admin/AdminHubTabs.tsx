import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminHubTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface AdminHubTabsProps {
  title: string;
  description: string;
  param?: string;
  defaultTab: string;
  tabs: AdminHubTab[];
}

export function AdminHubTabs({
  title,
  description,
  param = "tab",
  defaultTab,
  tabs,
}: AdminHubTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = new Set(tabs.map((tab) => tab.id));
  const requested = searchParams.get(param) || defaultTab;
  const activeTab = allowed.has(requested) ? requested : defaultTab;

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(param, value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Tabs value={activeTab} onValueChange={setTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="min-h-11 px-4">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            forceMount
            className="mt-5 focus-visible:outline-none data-[state=inactive]:hidden"
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
