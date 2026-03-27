import { useState } from "react";

export default function App() {
  const [images, setImages] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (images.length === 0) return alert("Upload images");

    const formData = new FormData();
    images.forEach(img => formData.append("images", img));

    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/generate-from-image", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      setResult(data.data);
    } catch (err) {
      alert("Error generating listing");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>eBay AI Listing Generator</h2>

      <input
        type="file"
        multiple
        onChange={(e) => setImages([...e.target.files])}
      />

      <br /><br />

      {images.map((file, i) => (
  <img
    key={i}
    src={URL.createObjectURL(file)}
    alt=""
    width={100}
    style={{ margin: 5 }}
  />
))}

      <button onClick={handleUpload}>
        {loading ? "Generating..." : "Generate Listing"}
      </button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Result</h3>

          <pre style={{ background: "#eee", padding: 10 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}