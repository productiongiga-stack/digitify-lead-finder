"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { ArrowLeft, Camera, KeyRound, Loader2, LogOut, Save, ShieldCheck, Trash2, UserCircle } from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "U";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AccountSettingsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery();
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setImage(profile.image || "");
  }, [profile]);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.user.getProfile.invalidate();
      showToast({ title: "Profiel opgeslagen", description: "Je accountgegevens zijn bijgewerkt." });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast({ title: "Wachtwoord gewijzigd", description: "Gebruik je nieuwe wachtwoord bij je volgende login." });
    },
    onError: (error) => showToast({ title: "Wachtwoord niet gewijzigd", description: error.message, variant: "error" }),
  });

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        showToast({ title: "Upload mislukt", description: payload.error || "Kon de foto niet uploaden.", variant: "error" });
        return;
      }
      setImage(payload.url);
      await updateProfile.mutateAsync({ name: name || profile?.name || profile?.email || "Gebruiker", image: payload.url });
    } finally {
      setUploading(false);
    }
  }

  function saveProfile() {
    updateProfile.mutate({ name, image });
  }

  function savePassword() {
    if (newPassword !== confirmPassword) {
      showToast({ title: "Controleer wachtwoord", description: "De nieuwe wachtwoorden komen niet overeen.", variant: "error" });
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/settings" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Terug naar instellingen
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Account & Profiel</h1>
          <p className="text-sm text-muted-foreground">Beheer je naam, profielfoto en wachtwoord.</p>
        </div>
        <Badge variant="outline" className="w-fit">
          {profile?.role || "Account"}
        </Badge>
      </div>

      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-white/15">
              {image ? <AvatarImage src={image} alt={name || profile?.email || "Profiel"} /> : null}
              <AvatarFallback className="bg-white/10 text-lg text-white">{initials(name, profile?.email)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Ingelogd als</p>
              <p className="mt-1 text-lg font-semibold">{name || profile?.email || "Gebruiker"}</p>
              <p className="text-sm text-white/60">{profile?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" />
            Uitloggen
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile">Profiel</TabsTrigger>
          <TabsTrigger value="security">Beveiliging</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle className="h-4 w-4" />
                Profielfoto
              </CardTitle>
              <CardDescription>Wordt gebruikt in de topbar en accountmenu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {image ? <AvatarImage src={image} alt={name || "Profiel"} /> : null}
                  <AvatarFallback className="text-lg">{initials(name, profile?.email)}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAvatar(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    Foto uploaden
                  </Button>
                  {image ? (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setImage("")}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Maximaal 2MB. PNG, JPG, WebP of SVG.</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Accountgegevens</CardTitle>
              <CardDescription>Je e-mailadres is je login en kan hier niet aangepast worden.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Profiel laden...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Naam</Label>
                    <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Je naam" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mailadres</Label>
                    <Input value={profile?.email || ""} disabled />
                  </div>
                  <Button onClick={saveProfile} disabled={updateProfile.isPending || !name.trim()}>
                    {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Profiel opslaan
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Wachtwoord wijzigen
              </CardTitle>
              <CardDescription>Kies een sterk wachtwoord voor je account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Huidig wachtwoord</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Bevestig nieuw wachtwoord</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                </div>
              </div>
              <Button onClick={savePassword} disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}>
                {changePassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Wachtwoord opslaan
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-muted/30">
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold">Wachtwoordregels</p>
              <p className="text-sm text-muted-foreground">Minimaal 10 tekens, met kleine letter, hoofdletter en cijfer.</p>
              <p className="text-sm text-muted-foreground">Veelgebruikte wachtwoorden zoals `admin123` worden geweigerd.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
