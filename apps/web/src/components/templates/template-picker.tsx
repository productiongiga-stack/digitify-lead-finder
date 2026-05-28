"use client";

import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import { templateTypeLabel } from "@/lib/template-studio";

export type TemplatePickerItem = {
  id: string;
  name: string;
  subject: string;
  type: string;
  layout: string;
  isGlobal: boolean;
  campaign?: { id: string; name: string } | null;
};

type TemplatePickerProps = {
  value: string;
  onValueChange: (templateId: string) => void;
  templates: TemplatePickerItem[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
};

export function TemplatePicker({
  value,
  onValueChange,
  templates,
  placeholder = "Kies een template...",
  emptyLabel = "Geen template",
  disabled = false,
}: TemplatePickerProps) {
  return (
    <Select value={value || "none"} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{emptyLabel}</SelectItem>
        {templates.map((template) => (
          <SelectItem key={template.id} value={template.id}>
            <span className="flex flex-wrap items-center gap-1.5">
              <span>{template.name}</span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {templateTypeLabel(template.type)}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {template.layout}
              </Badge>
              {template.isGlobal ? (
                <Badge className="text-[10px] font-normal">Alle campagnes</Badge>
              ) : null}
              {template.campaign ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {template.campaign.name}
                </Badge>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
