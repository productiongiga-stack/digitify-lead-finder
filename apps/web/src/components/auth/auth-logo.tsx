import Image from "next/image";

type AuthLogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  textClassName?: string;
};

const sizeMap = {
  sm: { box: "h-9 w-9", image: 24 },
  md: { box: "h-12 w-12", image: 32 },
  lg: { box: "h-14 w-14", image: 38 },
};

export function AuthLogo({ size = "md", showText = false, textClassName = "text-[#0d1520]" }: AuthLogoProps) {
  const dimensions = sizeMap[size];

  return (
    <div className="inline-flex items-center gap-3">
      <span className={`flex ${dimensions.box} items-center justify-center rounded-md border border-[#f3dcc5] bg-white shadow-sm`}>
        <Image
          src="/favicon.ico"
          alt="Digitify"
          width={dimensions.image}
          height={dimensions.image}
          className="h-2/3 w-2/3 object-contain"
          priority
        />
      </span>
      {showText && (
        <span className={`leading-tight ${textClassName}`}>
          <span className="block text-base font-bold tracking-tight">Digitify</span>
          <span className="block text-xs opacity-70">Lead Finder</span>
        </span>
      )}
    </div>
  );
}
