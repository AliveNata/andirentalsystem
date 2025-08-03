import React, { useRef, useState } from 'react';

interface TermsAndConditionsProps {
  onAccept: () => void;
  onBack: () => void;
}

const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ onAccept, onBack }) => {
  const [isChecked, setIsChecked] = useState(false);
  const [canAccept, setCanAccept] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (termsRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = termsRef.current;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;
      setCanAccept(isAtBottom);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold mb-6">Syarat dan Ketentuan di Andi Rental Mobil</h2>
      <div 
        ref={termsRef}
        onScroll={handleScroll}
        className="prose prose-sm max-w-none h-[400px] overflow-y-auto mb-6 bg-gray-50 p-4 rounded-lg"
      >
        <h3>PERJANJIAN SEWA KENDARAAN</h3>
        <p>Persewaan ini memliki pasal-pasal dan ketentuan sebagai berikut:</p>

        <h4>A. Pasal 1</h4>
        <p>
          <b>Andi Rental Mobil</b> setuju menyewakan kepada <b>penyewa</b> dengan pembayaran dilakukan didepan dan <b>penyewa</b> wajib memberikan identitas data yang masih berlaku, serta membayar DP <i>(Down Payment)</i> bagi <b>penyewa</b> (DP <i>(Down Payment)</i> tidak bisa dikembalikan).
        </p>

        <h4>B. Pasal 2</h4>
        <p>
          Jika <b>penyewa</b> hendak memperpanjang masa sewa kendaraan wajib memberitahukan <b>Andi Rental Mobil</b> 1 (satu) hari sebelum masa sewa berakhir dan wajib membayar sesuai ketentuan di Pasal 1.
        </p>

        <h4>C. Pasal 3</h4>
        <p>
          Ketentuan jam operasional pemakaian kendaraan lepas kunci kepada <b>penyewa</b> maksimal 24jam/hari, apabila memakai jasa supir yaitu 12 jam dan apabila adanya keterlambatan pengembalian darijam operasional maka <b>penyewa</b> berkenan dikenakan biaya tambahan sebesar 10% perjam, jika keterlambatan lebih dari 4 jam maka akan dikenakan biaya 1 hari. 
        </p>

        <h4>D. Pasal 4</h4>
        <p>
          <b>Andi Rental Monil</b> menyerahkan dalam kondisi baik, bersih dan layak jalan. Oleh karena itu <b>penyewa</b> berkewaijban menjaga dan memelihara sebagaimana kondisi semula. Apabila <b>penyewa</b> mengalami kecelakaan, kehilangan kendaraan, kerusakan besar/kecil, kehilangan aksesoris dan perlengakapan kendaraan maka beban ganti rugi materil sepenuhnya akna menjadi tanggung jawab <b>penyewa</b>. 
        </p>

        <h4>E. Pasal 5</h4>
        <p>
           Apabila terjadinya insiden kecelakaan seperti: tabrakan seperti dalam <b>Pasal 4</b>, maka <b>penyewa</b> berkewajiban membayar premi asuransi kendaraan sebesar <b><i>Rp.500.000 / 1 kali kejadian</i></b> dan selama mobil masih dalam perbaikan di bengkel. <b>Penyewa</b> tetap membayar sewanya sesuai ketetapan pada <b>pasal 1</b> dan <b>Andi Rental Mobil</b> dibebaskan dari tuntuntan hukum. 
        </p>
        
        <h4>F. Pasal 6</h4>
        <p>
          Hal-hal yang tidak dapat dilakukan oleh <b>penyewa</b> selama masa penyewaan berlangsung tanpa persetujuan <b>Andi Rental Mobil</b>, yaitu:
        </p>
        <ul>
          <li><b>Penyewa</b> tidak dapat memindahtangankan / mengalihkan hak sewa yang diperoleh dari <b>Andi Rental Mobil</b> kepada <b>pihak lain</b> manapun juga, dan jika terjadi pengalihan maka <b>Andi Rental Mobil</b> dapat mengambil tindakan penarikan kendaraan seketika.</li>
          <li><b>Penyewa</b> tidak diperkenankan menggadaikan dan menganggunkan kendaraan kepada <b>pihak lain.</b> </li>
          <li><b>Penyewa</b> tidak diperkenankan menggunakan kendaraan untuk tindak pidana atau kejahatan laiinya yang melanggar ketentuan hukum mapun keasusilaan yang berlaku.</li>
          <li>Apabila dalam masa penyewaan <b>penyewa</b> melakukan penyalahgunaan yang bersifat melanggar hukum, maka sepenuhnya menjadi tanggung jawab <b>penyewa</b> dan apabila dalam kasus-kasus yang dimaksud diatas sehingga mobil disita atau digadaikan, maka <b>penyewa</b> juga diwajibkan membayar biaya sewa sesuai ketetapan di <b>pasal 1</b>.</li>
        </ul>

        <h4>G. Pasal 7</h4>
        <p>
           Apabila dalam masa sewa <b>penyewa</b> membatalkan perjanjian yang telah disepakati <b>Andi Rental Mobil</b> dan <b>Penyewa</b>, maka segala bentuk kerugian yang diakibatkan oleh pembatalan perjanjian secara sepihak sepenuhnya menjadi tanggung jawab <b>penyewa</b>. 
        </p>

        <h4>H. Pasal 8</h4>
        <p>
           Hal-hal yang belum diatur alam perjanjian wewa-menyewa iin akan dibicarakan secara musyawarah dan mufakat, apabila tidak tercapai mufakat, maka akan diatur sesuai hukum yg berlaku.  
        </p>

        <h3>Persetujuan</h3>
        <p>Dengan mencentang kotak persetujuan, Anda menyatakan telah membaca, memahami, dan setuju untuk mematuhi seluruh syarat dan ketentuan yang berlaku.</p>
      </div>

      <div className="flex items-center mb-6">
        <input
          type="checkbox"
          id="accept-terms"
          checked={isChecked}
          onChange={(e) => setIsChecked(e.target.checked)}
          disabled={!canAccept}
          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <label htmlFor="accept-terms" className="ml-2 text-sm text-gray-700">
          Saya telah membaca dan menyetujui syarat dan ketentuan yang berlaku
          {!canAccept && (
            <span className="text-orange-500 ml-1">
              (Harap scroll sampai bawah untuk menyetujui)
            </span>
          )}
        </label>
      </div>

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={!isChecked || !canAccept}
          className="flex-1 py-2 px-4 border border-transparent rounded-lg text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Setuju & Lanjutkan
        </button>
      </div>
    </div>
  );
};

export default TermsAndConditions;