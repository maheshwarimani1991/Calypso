/*
* Name        : GenerateCouponsBatch
* Description : GenerateCouponsBatch is a Batch class
                Functions : 
                1.  To Generate Coupons. 
* Author      : Himanshu Maheshwari
* Create On   : 28 Jan 2016
*  |-------------------------------------------------------------------------|
*  | Version | Modified By      | Date       | Comment                       |
*  |-------------------------------------------------------------------------|
*  | 0.1     | Himanshu         | 28/01/2016 | Initial Version of Class      |
*  |-------------------------------------------------------------------------|
*/
global class GenerateCouponsBatch implements Database.Batchable<sObject>, Database.Stateful {

    global String query;
    global Id couponTranId;
    global Coupon_Transaction__c couponTran;
    global Integer totalCouponCount;
    public Integer serialNumber = 1;
    public Integer batchSize = 2000;
    public Set<Integer> uniqueRandNumberSet;
    public Integer couponToPrint = 0;
    public Integer couponPendingToPrint;
    public Map<Id, Map<String, Map<String, Integer>>> partCatDemMap;
    public Map<String, String> schLineIdMap;
    public List<Contact> contactList;

    public GenerateCouponsBatch(Id couponTranId, Integer totalCouponCount){
        this.couponTranId = couponTranId;
        this.totalCouponCount = totalCouponCount;
        couponPendingToPrint = totalCouponCount;
    }

    global Database.QueryLocator start(Database.BatchableContext BC) {

        schLineIdMap = new Map<String, String>();
        uniqueRandNumberSet = new Set<Integer>();
        couponTran = [SELECT Id, Transaction_Comments__c, Name, OwnerId, Owner.Email, Product_Code__c, Scheme_Name__c, Coupon_To_Generate__c FROM Coupon_Transaction__c WHERE Id =: couponTranId];
        contactList = [SELECT Id FROM Contact WHERE User__c =: couponTran.OwnerId];
        CategoryPointsData(totalCouponCount);
        System.debug('partCatDemMap................' + partCatDemMap);
        Integer totalBatch = Integer.valueOf(Math.ceil(Decimal.valueof(totalCouponCount) / batchSize));
        query = 'SELECT Id FROM Part_Master__c LIMIT '+ totalBatch;
        System.debug('query..............' + query);
        return Database.getQueryLocator(query);
    }

    global void execute(Database.BatchableContext BC, List<Part_Master__c> scope) {
        
        if(scope.size() > 0){
            if(couponPendingToPrint > batchSize){
                couponToPrint = batchSize;
                couponPendingToPrint = couponPendingToPrint - batchSize;
            }
            else{
                couponToPrint = couponPendingToPrint;
            }
            
            GenerateUINMasterProduct(couponTranId, couponToPrint);
        }
    }

    global void finish(Database.BatchableContext BC) {
        AsyncApexJob a = [SELECT Id, Status, NumberOfErrors, JobItemsProcessed, TotalJobItems, CreatedBy.Email FROM AsyncApexJob WHERE Id =: BC.getJobId()];
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        couponTran.Transaction_Comments__c = 'Success';
        update couponTran;
        
        if(!Test.isRunningTest()){
            String[] toAddresses = new String[] {couponTran.Owner.Email};
            mail.setToAddresses(toAddresses);
            mail.setSubject('Coupon Succesfully Generated for : ' + couponTran.Name);
            mail.setHtmlBody('Coupon Succesfully Generated for ' + couponTran.Name + '<br/><br/> Thanks, <br/> Salesforce Team');
            Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
        }
    }


    public void GenerateUINMasterProduct(Id couponTranId, Integer couponQty) {

        User currentUser = [SELECT Id, Location__c FROM User WHERE Id = : UserInfo.getUserId() limit 1];
        
        List<string> strInnerList = GenerateSerialNumber.GenerateSN('Inner Master', couponTran.Product_Code__c, couponQty);
        List<UINMasterProduct__c> uniMasterProdList = new List<UINMasterProduct__c>();
        List<String> lstChildRec;
        List<String> lstChildElm;
        Integer countUin = 0;
        Integer countUin1 = -1;
        Integer ElmCount = 0;

        for (Integer couponCtr = 0; couponCtr < couponQty; couponCtr++) {

            String childUINData = '';
            if (partCatDemMap.get(couponTran.Product_Code__c) != NULL) {
                Set<String> categorySet = partCatDemMap.get(couponTran.Product_Code__c).keyset();
                List<String> categoryNameList = new List<String>();
                categoryNameList.addAll(categorySet);
                categoryNameList.sort();
                for (String catName : categoryNameList) {
                    for (String den : partCatDemMap.get(couponTran.Product_Code__c).get(catName).keyset()) {
                        if (partCatDemMap.get(couponTran.Product_Code__c).get(catName).get(den) != 0) {
                            if (childUINData != '') {
                                childUINData += '-';
                            }
                            if (schLineIdMap.get(catName + ':' + den) != NULL) {
                                childUINData += catName + ':' + den + ':' + schLineIdMap.get(catName + ':' + den);
                            } else {
                                childUINData += catName + ':' + den + ':';
                            }
                            partCatDemMap.get(couponTran.Product_Code__c).get(catName).put(den, partCatDemMap.get(couponTran.Product_Code__c).get(catName).get(den) - 1);
                            break;
                        }
                    }
                }
            }

            UINMasterProduct__c uniMasterProd = new UINMasterProduct__c();
            uniMasterProd.Coupon_Generation_Location__c =  currentUser.Location__c;
            uniMasterProd.Coupon_Transaction__c = couponTran.Id;
            uniMasterProd.Coupon_Scheme__c = couponTran.Scheme_Name__c;
            uniMasterProd.Part_Code__c = couponTran.Product_Code__c;
            uniMasterProd.Child_UIN_Text__c  =  childUINData;
            uniMasterProd.UIN_External__c = strInnerList[couponCtr];
            uniMasterProd.Generation_Date__c = System.now();
            uniMasterProd.Status__c = 'New';
            uniMasterProd.Product_Status__c = 'Usable';
            if(contactList.size() > 0)
                uniMasterProd.Assigned_To_Contact__c = contactList[0].Id;

            lstChildRec = new list<string>();
            lstChildElm = new list<string>();
            if (uniMasterProd.Child_UIN_Text__c != NULL) {
                lstChildRec = uniMasterProd.Child_UIN_Text__c.split('-', 0);
                for (string strRec : lstChildRec) {
                    countUin++;
                }
            }

            //uniMasterProd.Transfer_Status__c = 'Received';
            uniMasterProdList.add(uniMasterProd);
        }

        //if(uniMasterProdList.size() > 0)
        //    insert uniMasterProdList;

        
        Integer uinCount = 0;
        for(Integer i = 0; i <= totalCouponCount ; i++){
            if(uniMasterProdList.size() > uinCount){
                Integer rand = Math.floor(Math.random() * totalCouponCount).intValue();
                rand++;

                if(uniqueRandNumberSet.contains(rand)){
                    i = i-1;
                }else{
                    uniMasterProdList[uinCount].Serial_Number__c = rand;
                    uinCount++;
                    uniqueRandNumberSet.add(rand);
                }
            }
        }

        if(uniMasterProdList.size() > 0)
            insert uniMasterProdList;

        System.debug('uniMasterProdList-----------------------------' + uniMasterProdList);

        List<String> uinUList = GenerateSerialNumber.GenerateSN('Master', couponTran.Product_Code__c, countUin);
        List<UINMasterProduct__c> uinMasterProductList = new List<UINMasterProduct__c>();
        Map<Integer, List<UINMasterProduct__c>> uinMasterProductMap = new Map<Integer, List<UINMasterProduct__c>>();
        Integer listCount = 0;
        UINMasterProduct__c uniMasRec;
        Map<String, String> parentCouponMap = new Map<String, String>();
        //Integer serialNo = 1;
        for (UINMasterProduct__c uniMasterProd : uniMasterProdList) {
        //for (UINMasterProduct__c uniMasterProd : [SELECT Id, Status__c, Serial_Number__c, Product_Status__c, Generation_Date__c, Coupon_Scheme__c, Part_Code__c, Coupon_Generation_Location__c, Coupon_Transaction__c, Child_UIN_Text__c, UIN_External__c FROM UINMasterProduct__c WHERE Id IN: uniMasterProdList ORDER BY Serial_Number__c ASC]) {
            Boolean isParent = TRUE;
            lstChildRec = new list<string>();
            lstChildElm = new list<string>();
            Boolean firstProd = TRUE;
            if (uniMasterProd.Child_UIN_Text__c != NULL) {
                lstChildRec = uniMasterProd.Child_UIN_Text__c.split('-', 0);
                for (string strRec : lstChildRec) {
                    countUin1++;
                    if (strRec != NULL) {
                        if (isParent) {
                            uniMasRec = uniMasterProd;
                            //uniMasRec.Coupon_Count__c = serialNo;
                            isParent = FALSE;
                        } else {
                            uniMasRec = uniMasterProd.clone();
                            //uniMasRec.Coupon_Count__c = serialNo;
                            uniMasRec.Id = NULL;
                            uniMasRec.Parent_MasterProduct__c = uniMasterProd.Id;
                        }

                        //serialNo = serialNo + 1;
                        lstChildElm = strRec.split(':', 0);
                        ElmCount = 0;

                        for (string strElm : lstChildElm) {
                            if (ElmCount == 0)
                                uniMasRec.Coupon_Category__c = strElm;
                            if (ElmCount == 1)
                                uniMasRec.Coupon_Points__c = Double.valueof(strElm);

                            //recProdUIN.Coupon_UIN__c = srMaster;
                            if (ElmCount == 2)
                                uniMasRec.Scheme_Line__c = strElm;
                            ElmCount++;
                        }
                        
                        if (uinUList.size() > 0 && uinUList != NULL){
                            uniMasRec.Coupon_UIN__c = uinUList[countUin1];
                            if(!parentCouponMap.containsKey(uniMasterProd.UIN_External__c))
                                parentCouponMap.put(uniMasterProd.UIN_External__c, uniMasterProd.Coupon_UIN__c);
                        }

                        if (uniMasRec != NULL) {
                            if (uinMasterProductList.size() < 10000) {
                                uinMasterProductList.add(uniMasRec);
                            } else {
                                uinMasterProductMap.put(listCount, uinMasterProductList);
                                listCount++;
                                uinMasterProductList = new List<UINMasterProduct__c>();
                                uinMasterProductList.add(uniMasRec);
                            }
                        }
                    }
                }
            }
        }

        uinMasterProductMap.put(listCount, uinMasterProductList);

        System.debug('uinMasterProductMap -------------------------' + uinMasterProductMap);
        if (uinMasterProductMap.keySet().size() > 0) {
            for (Integer i = 0; i < uinMasterProductMap.keySet().size() ; i++) {
                if (uinMasterProductMap.containsKey(i)) {
                    uinMasterProductList = uinMasterProductMap.get(i);
                    upsert uinMasterProductList;
                }
            }
        }
    }

    public void CategoryPointsData(Integer couponQty) {
        partCatDemMap = new Map<Id, Map<String, Map<String, Integer>>>();
        Map<String, Map<string, Integer>> catDemMap;
        Map<String, Integer> demMap;
        Map<String, Integer> partQtyMaster = new Map<String, Integer>();
        Map<String, Schema.SobjectType> descSobjResult = Schema.getGlobalDescribe();

        Set<String> sLineTypeList = new Set<String>();
        Schema.DescribeFieldResult fieldResult = Scheme_Line__c.Type__c.getDescribe();
        List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();

        for ( Schema.PicklistEntry f : ple) {
            sLineTypeList.add(f.getValue());
        }

        String categoryName = '';
        Integer qty = 0;
        Integer partQtyTotal = 0;
        Double partialQty = 0;
        String denomination = '';

        Map<String, Decimal> categoryQuanityMap = new Map<String, Decimal>();
        List<Scheme_Line__c> schLineList = [SELECT Id, Legacy_Part_Code__c, Final_Denomination__c, Quantity__c, Type__c FROM Scheme_Line__c WHERE Legacy_Part_Code__c = : couponTran.Product_Code__c AND Active__c = TRUE AND Scheme__r.Scheme_Status__c = 'Active'];
        if (schLineList != NULL && schLineList.size() > 0) {
            categoryQuanityMap = new Map<String, Decimal>();
            for (Scheme_Line__c sLine : schLineList) {
                if(categoryQuanityMap.containsKey(sLine.Type__c)){
                    Decimal cQty = categoryQuanityMap.get(sLine.Type__c);
                    cQty = cQty + sLine.Quantity__c;
                    categoryQuanityMap.put(sLine.Type__c, cQty);
                }else{
                    categoryQuanityMap.put(sLine.Type__c, sLine.Quantity__c);
                }
            }
            System.debug('categoryQuanityMap............'+ categoryQuanityMap);

            for (Scheme_Line__c sLine : schLineList) {
                categoryName = sLine.Type__c;

                if (sLine.Quantity__c != NULL)
                    qty = sLine.Quantity__c.intValue();
                else
                    qty = 0;

                if (sLine.Final_Denomination__c != NULL)
                    denomination = String.Valueof(sLine.Final_Denomination__c);
                else
                    denomination = '';

                if (schLineIdMap.get(categoryName + ':' + denomination) == NULL)
                    schLineIdMap.put(categoryName + ':' + denomination, sLine.Id);

                if (partCatDemMap.get(sLine.Legacy_Part_Code__c) != NULL) {
                    if (partCatDemMap.get(sLine.Legacy_Part_Code__c).get(CategoryName) != NULL) {
                        if (partCatDemMap.get(sLine.Legacy_Part_Code__c).get(CategoryName).get(denomination) != NULL)
                            partCatDemMap.get(sLine.Legacy_Part_Code__c).get(CategoryName).put(denomination, partCatDemMap.get(sLine.Legacy_Part_Code__c).get(CategoryName).get(Denomination) + Qty);
                        else
                            partCatDemMap.get(sLine.Legacy_Part_Code__c).get(CategoryName).put(denomination, qty);
                    } else {
                        demMap = new Map<String, Integer>();
                        demMap.put(denomination, qty);
                        partCatDemMap.get(sLine.Legacy_Part_Code__c).put(categoryName, demMap);
                    }
                } else {
                    catDemMap = new Map<String, Map<String, Integer>>();
                    demMap = new Map<String, Integer>();
                    demMap.put(denomination, qty);
                    catDemMap.put(categoryName, demMap);
                    partCatDemMap.put(sLine.Legacy_Part_Code__c, catDemMap);
                }
            }
        }

        System.debug('partCatDemMap ------------------------------' + partCatDemMap);

        String lowDen = '0';
        Integer roundedCount = 0;
        for (ID pId : partCatDemMap.keyset()) {
            for (String catName : partCatDemMap.get(pId).keySet()) {

                partQtyTotal = 0;
                lowDen = '0';
                roundedCount = 0;

                for (String den : partCatDemMap.get(pId).get(catName).keySet()) {
                    partQtyTotal += partCatDemMap.get(pId).get(catName).get(den);
                }

                for (String den : partCatDemMap.get(pId).get(catName).keySet()) {
                    if (lowDen == '0' || Integer.valueOf(den) < Integer.valueOf(lowDen))
                        lowDen = den;

                    //partialQty = (partCatDemMap.get(pId).get(catName).get(den) * couponQty);
                    Integer catQty = Integer.valueOf(math.ceil(categoryQuanityMap.get(catName)/100 * couponQty));
                    partialQty = (partCatDemMap.get(pId).get(catName).get(den) * catQty);
                    partialQty = partialQty / double.valueof(partQtyTotal);

                    if (partialQty < 1) {
                        partialQty++;
                    }

                    partCatDemMap.get(pId).get(catName).put(den, math.round(math.floor(partialQty)));
                    roundedCount += math.round(math.floor(partialQty));
                }

                //if (roundedCount < couponQty) {
                Integer catQty = Integer.valueOf(math.ceil(categoryQuanityMap.get(catName)/100 * couponQty));
                if (roundedCount < catQty) {
                    Integer diff = Integer.valueOf(couponQty) - roundedCount;
                    partCatDemMap.get(pId).get(catName).put(lowDen, partCatDemMap.get(pId).get(catName).get(lowDen) + diff);

                }
                System.debug('partCatDemMap 2==' + partCatDemMap);
            }   
        }
    }
}