# 🐚 Madlen AI: Multi-Modal Chat & Full-Stack Observability

Madlen AI, modern dil modelleriyle etkileşim kurarken sistem performansını ve veri akışını uçtan uca izleyen, mühendislik odaklı bir vaka çalışmasıdır. Proje, sadece bir sohbet arayüzü sunmakla kalmaz; FastAPI ve React mimarisini OpenTelemetry (Jaeger) ile birleştirerek sistem analizi kabiliyetlerini sergiler.

<br>


## 🔗 Kaynak Kodu 
Projenin tüm kaynak kodlarına aşağıdaki linkten erişebilir veya veyisTurgut kullanıcısını collaborator olarak eklenmiş depoyu inceleyebilirsiniz:

GitHub Repository: https://github.com/tahirrgunduz/madlen-case-study


<br>


## Öne Çıkan Özellikler

  Multi-Modal Interaction (Vision): Base64 kodlama altyapısı sayesinde görselleri analiz edebilen LLM entegrasyonu (Molmo, Gemini, Llama 3.2 Vision vb.).

  Full-Stack Observability: OpenTelemetry standartları kullanılarak Backend süreçlerinin Jaeger üzerinden dağıtık izleme (distributed tracing) ile takip edilmesi.

  Dinamik Model Benchmarking: OpenRouter üzerinden sadece "ücretsiz" modelleri filtreleyen ve sistem performansına göre model seçimi sunan dinamik yapı.

  Persistans & Oturum Yönetimi: SQLite tabanlı veritabanı ile geçmişe dönük sohbet oturumlarının ve görsel metadata bilgilerinin saklanması.

  Modern UI/UX: "AI Düşünüyor" animasyonu, gelişmiş hata yönetimi ve markaya özel logo/tema tasarımı.



<br>

## Teknik

| Katman | Teknoloji |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | FastAPI (Python 3.10), Pydantic, Httpx, OpenTelemetry |
| **Database** | SQLite3 |
| **Monitoring** | Jaeger (Distributed Tracing) |
| **External API** | OpenRouter (LLM Gateway) |


<br>


## Kurulum ve Çalıştırma



### 1. Backend Hazırlığı

##### Gerekli kütüphaneleri yükleyin

```bash
cd backend
```

```bash
pip install -r requirements.txt
```

<br>

##### Sunucuyu başlatın

```bash
python main.py
```



<small>*Not: .env dosyasında geçerli bir OPENROUTER_API_KEY tanımlı olmalıdır.*</small>


---

### 2. Frontend Hazırlığı


##### Bağımlılıkları yükleyin ve geliştirme sunucusunu başlatın:

```bash
cd frontend
```

```bash
npm install
```


```bash
npm run dev
```


---


### 3. Observability (Jaeger Setup)

##### Sistem performansını uçtan uca izlemek için Jaeger'i Docker üzerinden başlatın:

```bash
docker run -d --name jaeger -p 16686:16686 -p 4317:4317 jaegertracing/all-in-one:1.35
```

<small>*Trace verilerine http://localhost:16686 üzerinden erişilebilir.*</small>


<br>




## 📈 Mimari Notlar

- **Tip Güvenliği (Type Safety):** Frontend'de TypeScript interface'leri ile multi-modal veri yapıları standardize edilmiştir.

- **Gelişmiş Hata Yakalama:** API tarafındaki Rate Limit (429) ve Vision uyuşmazlığı (404) hataları kullanıcı dostu mesajlara dönüştürülmüştür.

<br>





## 🖼️ Multi-Modal Veri Akışı

Sistem, kullanıcıdan gelen metin ve görsel verilerini base64 formatında paketleyerek asenkron bir şekilde Backend'e iletir. Aşağıdaki görselde, sistemin bir ekran görüntüsünü başarıyla analiz edip yanıt döndürdüğü süreç görülmektedir.

- **[!TIP] İşlem Akışı:** Frontend (React) ➔ Multipart Request ➔ Backend (FastAPI) ➔ OpenRouter Vision API ➔ SQLite (Persistans).





<br>
<br>


## 🕵️ Jaeger ile Uçtan Uca İzleme (Observability)

**Erişim:** Jaeger arayüzüne http://localhost:16686 üzerinden erişebilirsiniz.

**Görüntüleme:** Sol paneldeki "Service" kısmından fastapi-service (veya backend servis adınız) seçerek "Find Traces" butonuna basın.

Projenin en kritik özelliği, her bir isteğin sistem içinde geçirdiği sürenin OpenTelemetry ile izlenmesidir. Aşağıdaki Jaeger trace çıktısı, bir mesajın veritabanına kaydedilmesi ve API'den yanıt alınması arasındaki tüm "span" (işlem adımı) sürelerini doğrulamaktadır.

API Latency: Dış servis yanıt süreleri milisaniye hassasiyetinde takip edilir.

Database Spans: SQLite yazma süreçlerinin sistem performansına etkisi analiz edilebilir.



<br>


--- 
*Bu proje, Madlen bünyesinde gerçekleştirilen teknik bir vaka çalışması (Case-Study) olarak geliştirilmiştir.*






