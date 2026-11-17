import { mkdir, writeFile } from 'node:fs/promises';
const common = [
 ['full-name','Full name','पूरा नाम','text',true],
 ['dob','Date of birth','जन्म तिथि','date',true],
];
const sets = [
 ['sample-lantern-hill-admission','Lantern Hill College of Arts and Sciences (fictional)','College admission',[
  ...common,['guardian','Guardian name','अभिभावक का नाम','text',true],['address','Address','पता','text',true],
  ['course','Course choice','पाठ्यक्रम','choice',true,['Arts (demo)','Sciences (demo)']],['marks','Previous marks','पिछले अंक','number',false],['photo','Photo','तस्वीर','photo',false],['signature','Signature','हस्ताक्षर','signature',true]]],
 ['sample-moonfield-scholarship','Moonfield Merit Scholarship Trust (fictional)','Scholarship application',[
  ...common,['income-band','Family income band','पारिवारिक आय वर्ग','choice',true,['Band A (demo)','Band B (demo)','Band C (demo)']],['course','Course of study','पाठ्यक्रम','text',true],['statement','Short statement','संक्षिप्त कथन','text',true],['declaration','Declaration','घोषणा','checkbox',true],['signature','Signature','हस्ताक्षर','signature',true]]],
 ['sample-hollowbrook-hostel','Hollowbrook Residential Hostel (fictional)','Hostel admission',[
  ...common,['id-type','ID type','पहचान का प्रकार','choice',true,['Sample ID card','Sample student card','Sample other document']],['sample-id-number','Sample ID number','नमूना पहचान संख्या','text',false],['address','Address','पता','text',true],['emergency-contact-name','Emergency contact name','आपातकालीन संपर्क','text',true],['emergency-contact-phone','Emergency contact phone','आपातकालीन फ़ोन','text',false],['arrival-date','Arrival date','आगमन तिथि','date',true],['departure-date','Departure date','प्रस्थान तिथि','date',false],['signature','Signature','हस्ताक्षर','signature',true]]],
];
await mkdir('scripts/samples/templates',{recursive:true});
for (const [id,title,kind,rows] of sets) {
 const fields=rows.map(([fieldId,label,hi,type,required,choices],i)=>({id:fieldId,label,type,required,bbox:{x:.08,y:.21+i*.065,w:.84,h:.036},page:0,...(choices?{choices}:{}),...(fieldId==='dob'?{dateRole:'dob'}:{})}));
 const form={id,title,source:'sample',pages:[{index:0,widthPt:595.28,heightPt:841.89}],fields,kind,labelsHi:Object.fromEntries(rows.map(r=>[r[0],r[2]]))};
 await writeFile(`scripts/samples/templates/${id}.json`,JSON.stringify(form,null,2)+'\n');
}
