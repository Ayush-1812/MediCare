import HeroSection from "@/components/landing/HeroSection";
import WhyChooseSection from "@/components/landing/WhyChooseSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import AIEcosystemSection from "@/components/landing/AIEcosystemSection";
import FeaturedSpecialistsSection from "@/components/landing/FeaturedSpecialistsSection";
import AIMockupsSection from "@/components/landing/AIMockupsSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";

export default function Home() {
  return (
    <div className="font-sans overflow-hidden">
      <HeroSection />
      <WhyChooseSection />
      <HowItWorksSection />
      <AIEcosystemSection />
      <FeaturedSpecialistsSection />
      <AIMockupsSection />
      <FAQSection />
      <CTASection />
    </div>
  );
}
