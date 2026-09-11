import AnnouncementBar from "@/components/AnnouncementBar";
import BuyBox from "@/components/BuyBox";
import DeliveryTimeline from "@/components/DeliveryTimeline";
import Description from "@/components/Description";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ProductGallery from "@/components/ProductGallery";
import Reviews from "@/components/Reviews";
import StickyBar from "@/components/StickyBar";
import TrustBadge from "@/components/TrustBadge";
import { product } from "@/data/product";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-2 lg:gap-12">
          <ProductGallery images={product.gallery} alt={product.title} />
          <div className="flex flex-col gap-5">
            <BuyBox />
            <TrustBadge />
            <DeliveryTimeline />
          </div>
        </section>
        <Description />
        <Reviews />
      </main>
      <Footer />
      <StickyBar />
    </>
  );
}
