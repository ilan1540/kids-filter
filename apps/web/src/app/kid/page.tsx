import { Suspense } from "react";
import { KidScreen } from "./screen";

export const metadata = { title: "הסרטונים שלי" };

export default function KidPage() {
  return (
    <Suspense>
      <KidScreen />
    </Suspense>
  );
}
