// 専用のスタンドアロン Apps Script に配置する。既存業務GASには追加しない。
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('勝馬AI 読み取りテスト').addMetaTag('viewport','width=device-width, initial-scale=1');}
function readHorseImage(image, consent){
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('KEIBA_ENABLED')!=='true')throw new Error('読み取りは無効です');
 const allowed=props.getProperty('KEIBA_ALLOWED_EMAIL');
 const user=Session.getActiveUser().getEmail();
 if(!allowed||!user||user.toLowerCase()!==allowed.toLowerCase())throw new Error('許可されたGoogleアカウントで開いてください');
 const key=props.getProperty('KEIBA_OPENAI_API_KEY');
 if(!key)throw new Error('APIキー未設定');
 if(consent!==true||typeof image!=='string'||image.length>4000000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))throw new Error('画像と送信同意を確認してください');
 const lock=LockService.getScriptLock();lock.waitLock(5000);
 try{
 const month=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM');
 const k='KEIBA_CALLS_'+month,n=Number(props.getProperty(k)||'0');
 // 初回検証は最大4回。円換算による厳密な課金上限ではない。
 if(n>=4)throw new Error('初回テストの月間4回上限に達しました');
 props.setProperty(k,String(n+1));
 }finally{lock.releaseLock();}
 const prompt='競馬新聞の切り抜きから印刷された情報のみ抽出。推測禁止。不明はnull。過去走は最大4走。手書き印は別配列。採点しない。JSON形式: {"horse_name":null,"past_races":[{"distance_m":null,"finish":null,"grade":null}],"training_text":null,"handwritten_marks":[],"uncertain_fields":[]}';
 const response=UrlFetchApp.fetch('https://api.openai.com/v1/responses',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+key},payload:JSON.stringify({model:'gpt-4.1-mini',max_output_tokens:850,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image,detail:'high'}]}],text:{format:{type:'json_object'}}}),muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('AI通信エラー '+response.getResponseCode()+'。再実行前に利用状況を確認してください');
 const raw=JSON.parse(response.getContentText()), text=(raw.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
 return {result:JSON.parse(text),usage:raw.usage||null};
}