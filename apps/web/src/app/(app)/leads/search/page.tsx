"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  Label,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@digitify/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import {
  Search,
  MapPin,
  Building,
  Globe,
  Loader2,
  Star,
  Phone,
  ExternalLink,
  Check,
  AlertCircle,
  Settings,
  RefreshCw,
  Save,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";

type SearchResult = {
  placeId: string;
  displayName: string;
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
};

type ExistingLead = {
  id: string;
  gmbPlaceId: string | null;
  companyName: string;
  overallScore: number | null;
  scorePriority: string | null;
};

function calcPreviewScore(result: SearchResult): { score: number; priority: string } {
  let score = 50;
  if (!result.websiteUri) score += 20;
  if (result.rating != null) {
    if (result.rating < 3.5) score += 10;
    else if (result.rating > 4.5) score -= 10;
  }
  if (result.userRatingCount != null) {
    if (result.userRatingCount === 0) score += 10;
    else if (result.userRatingCount < 5) score += 5;
    else if (result.userRatingCount > 50) score -= 5;
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    priority: score >= 75 ? "Hot" : score >= 50 ? "Warm" : "Low",
  };
}

function scoreBadgeClasses(priority: string) {
  switch (priority) {
    case "Hot":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
    case "Warm":
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  }
}

const PAGE_VIEW_SIZE = 20;
const RECENT_SEARCHES_STORAGE_KEY = "digitify-recent-searches";
const FALLBACK_POPULAR_TERMS = [
  "Webdesign Gent",
  "SEO bureau Antwerpen",
  "Marketingbureau Brussel",
  "Google Ads bureau Gent",
  "Social media bureau Antwerpen",
  "Branding bureau Leuven",
  "Loodgieter Gent",
  "Elektricien Antwerpen",
  "Dakwerker Brussel",
  "Schilder Gent",
  "Tandarts Antwerpen",
  "Kinesist Mechelen",
  "Fysiotherapeut Hasselt",
  "Restaurant Antwerpen",
  "Traiteur Gent",
  "Koffiebar Brussel",
  "Kapper Brussel",
  "Schoonheidssalon Antwerpen",
  "Nagelstudio Leuven",
  "Barbershop Gent",
  "Immokantoor Leuven",
  "Boekhouder Brugge",
  "Verzekeringsmakelaar Gent",
  "Advocaat Brussel",
  "Notaris Gent",
  "Autogarage Kortrijk",
  "Fietsenwinkel Gent",
  "Carrosserie Antwerpen",
  "Tuinarchitect Aalst",
  "Bakkerij Sint-Niklaas",
  "Fotograaf Leuven",
  "Schrijnwerker Brugge",
  "Ramen en deuren Turnhout",
  "Keukenbouwer Antwerpen",
  "Interieurarchitect Gent",
];

function formatSearchErrorMessage(message: string) {
  if (
    message.includes("String must contain at least 1 character") ||
    message.includes("Vul minstens")
  ) {
    return "Vul minstens een zoekterm, niche of stad in om leads te zoeken.";
  }

  return message;
}

export default function LeadSearchPage() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("België");
  const [niche, setNiche] = useState("");
  const [pageSize, setPageSize] = useState("15");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedLeadIds, setSavedLeadIds] = useState<Map<string, string>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [lastSearchParams, setLastSearchParams] = useState<{
    query: string;
    city: string;
    country: string;
    niche?: string;
    pageSize: number;
  } | null>(null);

  // Campaign dialog
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignLeadId, setCampaignLeadId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const { showToast } = useToast();

  // Campaigns list
  const campaignsQuery = trpc.campaign.list.useQuery();
  const popularSearchesQuery = trpc.search.getPopularSearches.useQuery(undefined, {
    staleTime: 300_000,
  });

  // Duplicate detection
  const placeIds = useMemo(() => results.map((r: SearchResult) => r.placeId), [results]);
  const existingLeadsQuery = trpc.search.checkExistingLeads.useQuery(
    { placeIds },
    { enabled: placeIds.length > 0 }
  );
  const existingLeadsMap = useMemo(() => {
    const map = new Map<string, ExistingLead>();
    if (existingLeadsQuery.data) {
      for (const lead of existingLeadsQuery.data) {
        if (lead.gmbPlaceId) map.set(lead.gmbPlaceId, lead);
      }
    }
    return map;
  }, [existingLeadsQuery.data]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.filter((item): item is string => typeof item === "string").slice(0, 8));
      }
    } catch {
      // ignore storage issues
    }
  }, []);

  // Mark existing leads as saved
  useEffect(() => {
    if (existingLeadsMap.size > 0) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        for (const placeId of existingLeadsMap.keys()) {
          next.add(placeId);
        }
        return next;
      });
      setSavedLeadIds((prev) => {
        const next = new Map(prev);
        for (const [placeId, lead] of existingLeadsMap.entries()) {
          next.set(placeId, lead.id);
        }
        return next;
      });
    }
  }, [existingLeadsMap]);

  const searchMutation = trpc.search.searchPlaces.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setHasSearched(true);
      setApiKeyMissing(false);
      setSavedIds(new Set());
      setSavedLeadIds(new Map());
      setSelectedIds(new Set());
      setCurrentPage(1);
    },
    onError: (error) => {
      if (error.data?.code === "PRECONDITION_FAILED") {
        setApiKeyMissing(true);
        setResults([]);
      }
      setHasSearched(true);
    },
  });

  const saveMutation = trpc.search.saveSearchResult.useMutation({
    onSuccess: (lead, variables) => {
      setSavedIds((prev) => new Set(prev).add(variables.placeId));
      setSavedLeadIds((prev) => new Map(prev).set(variables.placeId, lead.id));
    },
  });

  const addToCampaignMutation = trpc.campaign.addLeads.useMutation({
    onSuccess: () => {
      setCampaignDialogOpen(false);
      setCampaignLeadId(null);
      setSelectedCampaignId("");
      showToast({ title: "Lead toegevoegd", description: "De lead is aan de campagne gekoppeld." });
    },
    onError: (error) =>
      showToast({ title: "Toevoegen mislukt", description: error.message, variant: "error" }),
  });

  const doSearch = useCallback(
    (params: { query: string; city: string; country: string; niche?: string; pageSize: number }) => {
      setLastSearchParams(params);
      const summary = [params.query, params.niche, params.city].filter(Boolean).join(" • ").trim();
      if (summary) {
        setRecentSearches((prev) => {
          const next = [summary, ...prev.filter((item) => item !== summary)].slice(0, 8);
          try {
            localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore storage issues
          }
          return next;
        });
      }
      searchMutation.mutate(params);
    },
    [searchMutation]
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() && !niche.trim() && !city.trim()) return;
    doSearch({
      query,
      city,
      country,
      niche: niche || undefined,
      pageSize: parseInt(pageSize),
    });
  }

  function handleRefresh() {
    if (lastSearchParams) {
      searchMutation.mutate(lastSearchParams);
    }
  }

  function handleQuickSearch(q: string) {
    const normalized = q.replace(/\s+/g, " ").trim();
    const match = normalized.match(/^(.*?)[,\s]+([A-Za-zÀ-ÖØ-öø-ÿ-]+)$/);
    const searchQuery = (match?.[1] || normalized).trim();
    const searchCity = (match?.[2] || city).trim();
    setQuery(searchQuery);
    setCity(searchCity);
    doSearch({
      query: searchQuery,
      city: searchCity,
      country,
      niche: niche || undefined,
      pageSize: parseInt(pageSize),
    });
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch {
      // ignore storage issues
    }
  }

  function handleSave(result: SearchResult) {
    saveMutation.mutate(result);
  }

  async function handleBulkSave() {
    const toSave = results.filter(
      (r: SearchResult) => selectedIds.has(r.placeId) && !savedIds.has(r.placeId)
    );
    for (const result of toSave) {
      saveMutation.mutate(result);
    }
  }

  function toggleSelect(placeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r: SearchResult) => r.placeId)));
    }
  }

  function openCampaignDialog(leadId: string) {
    setCampaignLeadId(leadId);
    setSelectedCampaignId("");
    setCampaignDialogOpen(true);
  }

  function handleAddToCampaign() {
    if (!campaignLeadId || !selectedCampaignId) return;
    addToCampaignMutation.mutate({
      campaignId: selectedCampaignId,
      leadIds: [campaignLeadId],
    });
  }

  const unsavedSelectedCount = results.filter(
    (r: SearchResult) => selectedIds.has(r.placeId) && !savedIds.has(r.placeId)
  ).length;

  // Pagination
  const totalPages = Math.ceil(results.length / PAGE_VIEW_SIZE);
  const paginatedResults = results.slice(
    (currentPage - 1) * PAGE_VIEW_SIZE,
    currentPage * PAGE_VIEW_SIZE
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Lead Zoeken</h1>
        <p className="text-sm text-muted-foreground">
          Zoek nieuwe leads op basis van niche, locatie en zoekwoorden via Google Places
        </p>
      </div>

      {/* API key missing warning */}
      {apiKeyMissing && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Google Places API key niet geconfigureerd
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Configureer de Google Places API key in de instellingen om te zoeken.
              </p>
            </div>
            <Link href="/settings/integrations">
              <Button size="sm" variant="outline" className="shrink-0">
                <Settings className="mr-2 h-3 w-3" />
                Instellingen
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Search error (non-API-key) */}
      {searchMutation.error && !apiKeyMissing && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Zoekopdracht mislukt</p>
              <p className="text-xs text-muted-foreground">
                {formatSearchErrorMessage(searchMutation.error.message)}
              </p>
            </div>
            {lastSearchParams && (
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Opnieuw proberen
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compact search bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label className="text-xs">Zoekterm</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="bv. loodgieter, restaurant..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="min-w-[140px] space-y-1.5">
              <Label className="text-xs">Niche</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="bv. Horeca..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="min-w-[140px] space-y-1.5">
              <Label className="text-xs">Stad / Regio</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="bv. Gent..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-[120px] space-y-1.5">
              <Label className="text-xs">Land</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="België">België</SelectItem>
                  <SelectItem value="Nederland">Nederland</SelectItem>
                  <SelectItem value="Duitsland">Duitsland</SelectItem>
                  <SelectItem value="Frankrijk">Frankrijk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[80px] space-y-1.5">
              <Label className="text-xs">Aantal</Label>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={searchMutation.isPending || (!query.trim() && !niche.trim() && !city.trim())}
              >
                {searchMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Zoeken
              </Button>
              {lastSearchParams && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={searchMutation.isPending}
                  onClick={handleRefresh}
                  title="Vernieuw resultaten"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>

          {/* Popular search chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground">
              Populair:
            </span>
            {[
              ...(popularSearchesQuery.data && popularSearchesQuery.data.length > 0
                ? popularSearchesQuery.data
                : FALLBACK_POPULAR_TERMS),
            ].map((q) => (
              <Badge
                key={q}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => handleQuickSearch(q)}
              >
                {q}
              </Badge>
            ))}
          </div>

          {recentSearches.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">
                Recent:
              </span>
              {recentSearches.map((q) => (
                <Badge
                  key={q}
                  variant="secondary"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => handleQuickSearch(q.replace(/\s•\s/g, " "))}
                >
                  {q}
                </Badge>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearRecentSearches}>
                Wissen
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Results Area */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Zoekresultaten
              {hasSearched && !apiKeyMissing && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {results.length} resultaten gevonden
                </span>
              )}
            </CardTitle>
            {results.length > 0 && (
              <div className="flex items-center gap-2">
                {unsavedSelectedCount > 0 && (
                  <Button
                    size="sm"
                    onClick={handleBulkSave}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Opslaan geselecteerde ({unsavedSelectedCount})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Loading skeleton */}
          {searchMutation.isPending ? (
            <div className="space-y-0 divide-y rounded-md border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <Skeleton className="h-4 w-4 shrink-0 rounded" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : !hasSearched ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                Zoek naar bedrijven via Google Places
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vul een zoekterm, niche of stad in en klik op &quot;Zoeken&quot;.
              </p>
            </div>
          ) : results.length === 0 && !apiKeyMissing ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                Geen resultaten gevonden
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Probeer andere zoektermen of een andere stad.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Resultaten worden gevarieerd opgehaald en willekeurig gemengd zodat je minder snel dezelfde 20 ziet.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y rounded-md border">
                {/* Table Header */}
                {paginatedResults.length > 0 && (
                  <div className="flex items-center gap-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === results.length && results.length > 0}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
                    />
                    <span className="flex-1">Selecteer alles</span>
                    <span className="w-16 text-center">Score</span>
                    <span className="w-48 text-center">Acties</span>
                  </div>
                )}

                {paginatedResults.map((result: SearchResult) => {
                  const isSaved = savedIds.has(result.placeId);
                  const isSaving =
                    saveMutation.isPending &&
                    saveMutation.variables?.placeId === result.placeId;
                  const existingLead = existingLeadsMap.get(result.placeId);
                  const leadId = savedLeadIds.get(result.placeId) || existingLead?.id;
                  const { score, priority } = calcPreviewScore(result);
                  const isSelected = selectedIds.has(result.placeId);

                  return (
                    <div
                      key={result.placeId}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(result.placeId)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 accent-primary"
                      />

                      {/* Main content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium truncate">
                            {result.displayName}
                          </h3>
                          {result.primaryType && (
                            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                              {result.primaryType.replace(/_/g, " ")}
                            </Badge>
                          )}
                          {existingLead && (
                            <Link href={`/leads/${existingLead.id}`}>
                              <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950">
                                Al opgeslagen
                              </Badge>
                            </Link>
                          )}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {result.formattedAddress && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[200px]">{result.formattedAddress}</span>
                            </span>
                          )}

                          {result.rating != null && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {result.rating}
                              {result.userRatingCount != null && (
                                <span>({result.userRatingCount} reviews)</span>
                              )}
                            </span>
                          )}

                          {result.nationalPhoneNumber && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {result.nationalPhoneNumber}
                            </span>
                          )}

                          {result.websiteUri ? (
                            <a
                              href={result.websiteUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <Globe className="h-3 w-3" />
                              Website
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                              <Globe className="h-3 w-3" />
                              Geen website
                            </span>
                          )}

                          {result.googleMapsUri && (
                            <a
                              href={result.googleMapsUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Maps
                            </a>
                          )}

                          {/* Additional categories */}
                          {result.types && result.types.length > 1 && (
                            <span className="text-muted-foreground/60">
                              {result.types
                                .filter((t) => t !== result.primaryType)
                                .slice(0, 2)
                                .map((t) => t.replace(/_/g, " "))
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score badge */}
                      <div className="w-16 shrink-0 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${scoreBadgeClasses(priority)}`}
                        >
                          {score} {priority}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="w-48 shrink-0 flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant={isSaved ? "secondary" : "default"}
                          disabled={isSaved || isSaving}
                          onClick={() => handleSave(result)}
                          className="h-7 text-xs px-2.5"
                        >
                          {isSaving ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : isSaved ? (
                            <Check className="mr-1 h-3 w-3" />
                          ) : (
                            <Save className="mr-1 h-3 w-3" />
                          )}
                          {isSaved ? "Opgeslagen" : "Opslaan"}
                        </Button>
                        {isSaved && leadId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCampaignDialog(leadId)}
                            className="h-7 text-xs px-2"
                            title="Toevoegen aan campagne"
                          >
                            <FolderPlus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Pagina {currentPage} van {totalPages} ({results.length} resultaten)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Vorige
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Volgende
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Save error */}
          {saveMutation.error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {saveMutation.error.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add to Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={(open) => { if (!open) { setCampaignDialogOpen(false); setCampaignLeadId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toevoegen aan campagne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campagne kiezen</Label>
              {campaignsQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : campaignsQuery.data && campaignsQuery.data.length > 0 ? (
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kies een campagne..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignsQuery.data.map((campaign: NonNullable<typeof campaignsQuery.data>[number]) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Geen campagnes beschikbaar.{" "}
                  <Link href="/campaigns" className="text-primary hover:underline">
                    Maak een campagne aan
                  </Link>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Annuleren
            </Button>
            <Button
              disabled={!selectedCampaignId || addToCampaignMutation.isPending}
              onClick={handleAddToCampaign}
            >
              {addToCampaignMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="mr-2 h-4 w-4" />
              )}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
