import Link from 'next/link';

/** Trang chủ tạm thời của Sprint 1; trang menu được xây ở Task 4.3. */
export default function HomePage() {
  return (
    <main className="home">
      <h1>BrewLite</h1>
      <p>Đặt đồ uống và thanh toán ngay trên điện thoại.</p>
      <Link className="home__cta" href="/menu">
        Xem menu
      </Link>
    </main>
  );
}
