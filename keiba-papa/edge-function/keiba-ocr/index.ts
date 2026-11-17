// keiba-papa OCR proxy: deploy only to a dedicated Supabase project.
// Required secrets: OPENAI_API_KEY, KEIBA_OCR_ACCESS_TOKEN.
// Authentication is mandatory; never expose these secrets to GitHub Pages.
const cors={"Access-Control-Allow-Origin":"https://happysugar-system.github.io","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const expected=Deno.env.get("KEIBA_OCR_ACCESS_TOKEN"),key=Deno.env.get("OPENAI_API_KEY");
 if(!expected||!key)return json({error:"AI読み取りは未設定です"},503);
 if(req.headers.get("Authorization")!=="Bearer "+expected)return json({error:"Unauthorized"},401);
 const len=Number(req.headers.get("content-length")||0);
 if(len>8_000_000)return json({error:"画像サイズが大きすぎます"},413);
 let body;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 if(!body?.consent||typeof body.imageDataUrl!=="string"||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.imageDataUrl)||body.imageDataUrl.length>8_000_000)return json({error:"画像・送信同意を確認してください"},400);
 const model="gpt-4.1-mini";
 const prompt="日本語の競馬新聞の切り抜き画像から、印刷された馬名と過去走（最大4走）の距離・着順・格付けG1/G2/G3、調教欄の文字を読み取ってください。推測は禁止。不明な項目はnull。手書きの赤字や印は別の配列に記録し、印刷文字と混ぜない。採点はしない。JSONオブジェクトで返す。形式: {horse_name:string|null,past_races:[{distance_m:number|null,finish:number|null,grade:number|null}],training_text:string|null,handwritten_marks:string[],uncertain_fields:string[]}。";
 const upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model,max_output_tokens:850,input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:body.imageDataUrl,detail:"high"}]}]})});
 const raw=await upstream.json().catch(()=>({}));
 if(!upstream.ok)return json({error:"AIサービスの呼び出しに失敗しました",status:upstream.status},502);
 const txt=(raw.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==="output_text").map(c=>c.text).join("");
 let parsed;try{parsed=JSON.parse(txt)}catch{return json({error:"AIの回答を構造化できませんでした",raw_text:txt.slice(0,1500),usage:raw.usage||null},422)}
 return json({result:parsed,usage:raw.usage||null,model,warning:"自動採点前に読み取り内容を確認してください"});
});
