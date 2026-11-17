/* Papa's racing-paper scoring engine v0.2. No AI guesses. */
(function(root){
"use strict";
const finish={1:1.5,2:1,3:.5},grade={1:1.5,2:1,3:.5};
function score(input){
 const target=Number(input.targetDistance),items=[],warnings=[];
 function add(group,label,points,symbol,source){items.push({group,label,points,symbol:symbol||symbolFor(points),source:source||"rule"})}
 if(!Number.isFinite(target)||target<=0)throw Error("対象距離が不正です");
 const races=(input.races||[]).slice(0,4);
 races.forEach((r,i)=>{
  if(!r||r.distance==null||r.finish==null){warnings.push("過去"+(i+1)+"走の距離・着順が未確認");return}
  const d=Number(r.distance),p=Number(r.finish),g=Number(r.grade||0);
  if(!Number.isFinite(d)||d<=0||!Number.isFinite(p)){warnings.push("過去"+(i+1)+"走の値が不正");return}
  if(Math.abs(d-target)>200){add("基礎","過去"+(i+1)+"走：距離対象外",0,"—");return}
  add("基礎","過去"+(i+1)+"走：着順",finish[p]||0);
  if(p>=1&&p<=3&&g>=1&&g<=3)add("基礎","過去"+(i+1)+"走：重賞G"+g,grade[g]);
  if(d>=target)add("基礎","過去"+(i+1)+"走：同距離以上",.5);
 });
 if((input.races||[]).length<4)warnings.push("過去4走のうち未入力の走があります");
 if(input.kanto===true)add("基礎","関東厩舎",-1);
 const age=Number(input.age);if(Number.isFinite(age)&&age>=6){const agePenalty={6:-.5,7:-1,8:-2,9:-3};if(agePenalty[age]!=null)add("基礎","年齢"+age+"歳",agePenalty[age]);else warnings.push("10歳以上の年齢ルール未確定")}
 if(input.gelding===true)add("基礎","セン馬",-.5);
 if(input.intervalWeeks===1||input.intervalWeeks===2)add("基礎","中"+input.intervalWeeks+"週",-.5);
 if(input.excludedLastFour===true)add("基礎","過去4走に競走除外",- .5);
 if(input.jockeyChanged===true){if(input.jockeyWinRateAtTrack==null)warnings.push("騎手乗替：競馬場別勝率の確認が必要");else if(Number(input.jockeyWinRateAtTrack)<.15)add("基礎","騎手乗替（勝率15%未満）",-.5)}
 if(input.restDeduction!=null)add("基礎","休養（手動確認）",Number(input.restDeduction),"","manual");
 else if(input.restFlag===true)warnings.push("休養扱いの判定・減点が未確認");
 if(input.handicap===true){const w=Number(input.weight);const weights={50:3,50.5:3,51:2,51.5:2,52:1,52.5:1,53:.5,54:0,54.5:0,55:0,55.5:0,56:0,56.5:0,57:-1,57.5:-1,58:-1.5,58.5:-1.5,59:-2,59.5:-2};if(weights[w]==null)warnings.push("斤量"+w+"kgの採点ルール未確定");else add("基礎","ハンデ斤量"+w+"kg",weights[w])}
 if(input.trackBonus!=null){if(input.venue==="東京"&&Number(input.trackBonus)!==0)warnings.push("東京競馬場は競馬場実績ボーナスなし");else add("基礎","競馬場実績（手動確認）",Number(input.trackBonus),"","manual")}
 if(input.goingBonus!=null)add("基礎","道悪実績（手動確認）",Number(input.goingBonus),"","manual");
 (input.trainingMarks||[]).forEach((m,i)=>{if(m&&Number.isFinite(Number(m.points)))add("調教",m.label||"調教"+(i+1),Number(m.points),m.symbol||"","manual");else warnings.push("調教印"+(i+1)+"が未確認")});
 const base=items.filter(x=>x.group==="基礎").reduce((s,x)=>s+x.points,0),training=items.filter(x=>x.group==="調教").reduce((s,x)=>s+x.points,0);
 return {base,training,total:base+training,items,warnings};
}
function symbolFor(n){if(n===0)return "—";const unit=n>0?"○":"×",half=n>0?"△":"／";let t=Math.round(Math.abs(n)*2);return unit.repeat(Math.floor(t/2))+(t%2?half:"")}
root.PapaScore={score,symbolFor};
})(window);
