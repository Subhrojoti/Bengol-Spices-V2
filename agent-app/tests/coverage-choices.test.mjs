import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageChoices, coverageState, addressDefaults } from '../src/utils/coverageChoices.ts';

test('assigned state aliases merge without leaking pins or city suggestions across states', () => {
  const result=coverageChoices([
    {state:' west bangal ',city:' Kolkata ',pincodes:['743503','743503','bad']},
    {state:'WB',city:'kolkata',pincodes:[' 700001 ']},
    {state:'BIHAR',city:'Patna',pincodes:['800001']},
    {state:'INVALID',pincodes:[]},
  ]);
  assert.deepEqual(result,[{state:'BIHAR',cities:['Patna'],pincodes:['800001']},{state:'WEST BENGAL',cities:['Kolkata'],pincodes:['700001','743503']}]);
  assert.equal(coverageState('W.B.'),'WEST BENGAL');
});

test('only unambiguous assigned values are suggested; no guessed city or pin', () => {
  assert.deepEqual(addressDefaults({state:'X',cities:['First','Second'],pincodes:['100000','200000']}),{city:'',pincode:''});
  assert.deepEqual(addressDefaults({state:'X',cities:['First'],pincodes:['100000']}),{city:'First',pincode:'100000'});
  assert.deepEqual(addressDefaults(),{city:'',pincode:''});
  assert.deepEqual(coverageChoices([null,{state:null,pincodes:['700001']}]),[]);
});
