'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db, auth } from '@/lib/firebase/client';
import type { LabTest, FirestoreTest, LabPrice as LabPriceType, FirestoreTestLabPrice } from '@/types';
import { 
  Loader2, CheckCircle, PackagePlus, Tag, XSquare, ListPlus, Calculator, ShieldCheck, 
  Building, DollarSign, TagIcon, Info, Microscope, AlertTriangle, FlaskConical, Crown
} from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/context/CartContext';
import { cn } from '@/lib/utils';
import LabGroupedTestCard from '@/components/lab-grouped-test-card';
import MultiLabConfirmationDialog from '@/components/multi-lab-confirmation-dialog';
import { getOrCreateUserDocument } from '@/lib/firebase/firestoreService';

export interface GroupedTestOffering {
  testDocId: string;
  testName: string;
  testImageUrl?: string;
  price: number;
  originalPrice?: number;
}

export interface LabsWithSelectedTests {
  [labName: string]: GroupedTestOffering[];
}

export default function LabTestsPage() {
  const [allTests, setAllTests] = useState<LabTest[]>([]);
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [isLoadingTestNames, setIsLoadingTestNames] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { addToCart, items: cartItems } = useCart();
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [labsForConfirmation, setLabsForConfirmation] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<'member' | 'non-member' | 'admin'>('non-member');

  const handleFirestoreError = useCallback((error: any, context: string) => {
    console.error(`Firestore error (${context}):`, error);
    let description = `Could not fetch ${context}. Please try again later.`;
    if (error.name === 'FirebaseError') {
      if (error.code === 'unavailable') {
        description = `Connection to our servers failed (${context}). Please check your internet connection and try again.`;
      } else if (error.code === 'failed-precondition' && error.message.includes('index')) {
        description = `Database query for ${context} failed due to a missing index. Please contact support.`;
      } else if (error.code === 'permission-denied') {
        description = `Permission denied when fetching ${context}.`;
      } else {
        description = `Firebase error (${context}): ${error.message} (Code: ${error.code}).`;
      }
    }
    toast({
      title: `Error Fetching ${context}`,
      description,
      variant: "destructive",
    });
  }, [toast]);

  const transformTestDoc = useCallback((testDoc: QueryDocumentSnapshot<DocumentData>): Omit<LabTest, 'prices'> | null => {
    const testData = testDoc.data() as FirestoreTest;
    if (!testData.testName || typeof testData.testName !== 'string' || testData.testName.trim() === '') {
        console.warn(`transformTestDoc: Test document ${testDoc.id} is missing a valid testName. Skipping.`);
        return null;
    }
    const testSlug = testData.testName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    return {
        id: testSlug,
        docId: testDoc.id,
        name: testData.testName,
        imageUrl: testData.testImageUrl,
        description: testData.description,
        tags: testData.tags,
        bannerText: testData.bannerText,
        healthConcernSlugs: testData.healthConcernSlugs,
    };
  }, []);

  const fetchAndAttachPrices = useCallback(async (
    testsToPrice: LabTest[] 
  ): Promise<LabTest[]> => {
    if (testsToPrice.length === 0) return [];

    const testIds = testsToPrice.map(t => t.docId);
    const labPricesMap = new Map<string, LabPriceType[]>();

    const CHUNK_SIZE = 30; 
    for (let i = 0; i < testIds.length; i += CHUNK_SIZE) {
        const testIdChunk = testIds.slice(i, i + CHUNK_SIZE);
        if (testIdChunk.length > 0) {
            const pricesQuery = query(
                collection(db, "testLabPrices"),
                where("testId", "in", testIdChunk)
            );
            const pricesSnapshot = await getDocs(pricesQuery);
            pricesSnapshot.forEach(priceDoc => {
                const priceData = priceDoc.data() as FirestoreTestLabPrice;
                if (!priceData.labName || typeof priceData.labName !== 'string' || priceData.labName.trim() === '' || typeof priceData.price !== 'number') {
                    console.warn(`fetchAndAttachPrices: Price data for testId ${priceData.testId}, priceDocId ${priceDoc.id} has missing/invalid labName or price. Skipping price entry.`);
                    return;
                }
                const currentPrices = labPricesMap.get(priceData.testId) || [];
                currentPrices.push({
                    labName: priceData.labName,
                    price: priceData.price,
                    originalPrice: typeof priceData.originalPrice === 'number' ? priceData.originalPrice : undefined,
                    memberPrice: typeof priceData.memberPrice === 'number' ? priceData.memberPrice : undefined,
                });
                labPricesMap.set(priceData.testId, currentPrices);
            });
        }
    }

    for (const testId of labPricesMap.keys()) {
        const prices = labPricesMap.get(testId);
        if (prices) {
            prices.sort((a, b) => a.labName.localeCompare(b.labName));
            labPricesMap.set(testId, prices);
        }
    }
    
    return testsToPrice.map(test => ({
        ...test, 
        prices: labPricesMap.get(test.docId) || test.prices, 
    }));
  }, []);


  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingTestNames(true);
      let rawTestsData: LabTest[] = [];
      try {
        const testsCollectionRef = collection(db, "tests");
        const q = query(
          testsCollectionRef,
          where("isActive", "==", true),
          orderBy("testName", "asc")
        );
        const querySnapshot = await getDocs(q);
        
        const transformedTests: LabTest[] = [];
        querySnapshot.docs.forEach(doc => {
          const transformed = transformTestDoc(doc);
          if (transformed) {
            transformedTests.push({ ...transformed, prices: [] });
          }
        });
        rawTestsData = transformedTests;
        setAllTests(rawTestsData); 
        
      } catch (error: any) {
        handleFirestoreError(error, "All Active Tests (Names)");
        setAllTests([]); 
      } finally {
        setIsLoadingTestNames(false);
      }

      if (rawTestsData.length > 0) {
        try {
          const testsWithPrices = await fetchAndAttachPrices(rawTestsData); 
          setAllTests(testsWithPrices); 
        } catch (error: any) {
          handleFirestoreError(error, "Test Prices");
        }
      }
    };
    fetchInitialData();
  }, [handleFirestoreError, transformTestDoc, fetchAndAttachPrices]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      getOrCreateUserDocument(currentUser).then(userDoc => {
        setUserRole(userDoc?.role || 'non-member');
        console.log('userRole:', userDoc?.role || 'non-member');
      });
    } else {
      setUserRole('non-member');
      console.log('userRole: non-member');
    }
  }, []);

  const toggleTestSelection = (testToToggle: LabTest) => {
    setSelectedTests(prevSelected =>
      prevSelected.find(t => t.docId === testToToggle.docId)
        ? prevSelected.filter(t => t.docId !== testToToggle.docId)
        : [...prevSelected, testToToggle]
    );
  };

  const filteredTests = useMemo(() => {
    if (!searchTerm) return allTests;
    return allTests.filter(test =>
      test.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allTests, searchTerm]);

  const packageDetails = useMemo(() => {
    if (selectedTests.length === 0) {
      return { bestPrice: 0, totalMrp: 0, totalSavings: 0, itemsForCart: [] };
    }
    let totalBestPrice = 0;
    let totalMrp = 0;
    const itemsForCart: Array<Omit<import('@/context/CartContext').CartItem, 'quantity'>> = [];
    selectedTests.forEach(test => {
      if (test.prices && test.prices.length > 0) {
        const cheapestLabPrice = test.prices.reduce((min, p) => p.price < min.price ? p : min, test.prices[0]);
        totalBestPrice += cheapestLabPrice.price;
        totalMrp += cheapestLabPrice.originalPrice || cheapestLabPrice.price;
        itemsForCart.push({
            testDocId: test.docId,
            testName: test.name,
            testImageUrl: test.imageUrl,
            labName: cheapestLabPrice.labName,
            price: cheapestLabPrice.price,
            originalPrice: cheapestLabPrice.originalPrice,
            memberPrice: typeof cheapestLabPrice.memberPrice === 'number' ? cheapestLabPrice.memberPrice : undefined,
        });
      }
    });
    return {
      bestPrice: totalBestPrice,
      totalMrp: totalMrp,
      totalSavings: totalMrp - totalBestPrice,
      itemsForCart
    };
  }, [selectedTests]);
  
  const labsWithTheirSelectedTests = useMemo(() => {
    const grouped: LabsWithSelectedTests = {};
    if (selectedTests.length === 0) return grouped;
    selectedTests.forEach(test => {
      if (test.prices && test.prices.length > 0) {
        test.prices.forEach(labPrice => {
          if (!grouped[labPrice.labName]) {
            grouped[labPrice.labName] = [];
          }
          grouped[labPrice.labName].push({
            testDocId: test.docId,
            testName: test.name,
            testImageUrl: test.imageUrl,
            price: labPrice.price,
            originalPrice: labPrice.originalPrice,
            memberPrice: typeof labPrice.memberPrice === 'number' ? labPrice.memberPrice : undefined,
          });
        });
      }
    });
    return grouped;
  }, [selectedTests]);


  const proceedWithAddToCart = () => {
    packageDetails.itemsForCart.forEach(item => addToCart(item));
    toast({
      title: "Package Added to Cart",
      description: `${selectedTests.length} tests from your custom package added to cart.`,
    });
    setSelectedTests([]); 
  }

  const handleAddToCartPackage = () => {
    if (packageDetails.itemsForCart.length === 0) {
      toast({ title: "Empty Package", description: "Please select tests to add to your package.", variant: "destructive" });
      return;
    }
    const testsWithoutPrices = selectedTests.filter(t => !t.prices || t.prices.length === 0);
    if (testsWithoutPrices.length > 0) {
        toast({
            title: "Prices Still Loading",
            description: `Prices for ${testsWithoutPrices.map(t => t.name).join(', ')} are still loading. Please wait a moment and try again.`,
            variant: "default",
            duration: 5000,
        });
        return;
    }


    const uniqueLabsInPackage = new Set(packageDetails.itemsForCart.map(item => item.labName));
    if (uniqueLabsInPackage.size > 1) {
      setLabsForConfirmation(Array.from(uniqueLabsInPackage));
      setIsConfirmationDialogOpen(true);
    } else {
      proceedWithAddToCart();
    }
  };
  
  const handleConfirmMultiLabBooking = () => {
    proceedWithAddToCart();
    setIsConfirmationDialogOpen(false);
  };


  if (isLoadingTestNames && allTests.length === 0) { 
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-grow container mx-auto px-2 sm:px-4 py-4 pb-20"> 
        <Card className="shadow-xl rounded-xl mb-6">
          <CardHeader className="bg-primary/10 p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-primary flex items-center">
              <PackagePlus className="mr-2 h-6 w-6" /> Create Your Custom Package
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Select the tests you need, and we&apos;ll find the best prices for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search tests to add..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-border rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:border-primary"
                aria-label="Search tests"
              />
            </div>
            {isLoadingTestNames && allTests.length === 0 ? (
                <div className="flex justify-center py-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : (
                <ScrollArea className="h-[250px] sm:h-[300px] border rounded-lg p-3 bg-muted/30">
                {filteredTests.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {filteredTests.map(test => (
                        <Button
                        key={test.docId}
                        variant={selectedTests.find(t => t.docId === test.docId) ? "default" : "outline"}
                        onClick={() => toggleTestSelection(test)}
                        className={cn(
                            "text-xs sm:text-sm h-auto py-2.5 px-2.5 justify-start text-left break-words line-clamp-2 leading-tight shadow-sm transition-all duration-200 ease-in-out",
                            selectedTests.find(t => t.docId === test.docId) 
                            ? "bg-primary text-primary-foreground ring-2 ring-offset-2 ring-primary" 
                            : "bg-card hover:bg-secondary/50"
                        )}
                        >
                        {selectedTests.find(t => t.docId === test.docId) && <CheckCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                        {test.name}
                        </Button>
                    ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-10">
                    No tests found matching your search or no tests available.
                    </p>
                )}
                </ScrollArea>
            )}
          </CardContent>
        </Card>


        {selectedTests.length > 0 && (
          <Card className="shadow-xl rounded-xl sticky bottom-[70px] md:bottom-4 z-10 border-2 border-primary bg-gradient-to-tr from-primary/10 via-card to-secondary/10 mb-6">
            <CardHeader className="p-4 sm:p-5 border-b border-primary/20">
              <CardTitle className="text-lg sm:text-xl font-semibold text-primary flex items-center">
                <ListPlus className="mr-2 h-5 w-5" /> Your Custom Package Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <ScrollArea className="max-h-[240px] mb-2"> 
                <ul className="space-y-2">
                  {packageDetails.itemsForCart.map(item => {
                    const originalTest = selectedTests.find(st => st.docId === item.testDocId);
                    console.log('item.memberPrice', item.memberPrice, 'for', item.testName, item.labName);
                    return (
                      <li key={item.testDocId} className="p-2.5 border rounded-md bg-card/80 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{item.testName}</p>
                            <p className="text-xs text-muted-foreground flex items-center">
                              <Building className="mr-1 h-3 w-3" /> {item.labName} (Best Price Lab for this test in package)
                            </p>
                          </div>
                          <button 
                            onClick={() => originalTest && toggleTestSelection(originalTest)} 
                            className="text-destructive hover:text-destructive/80 p-1 -mr-1 -mt-1"
                            aria-label={`Remove ${item.testName} from package`}
                          >
                            <XSquare className="h-4 w-4"/>
                          </button>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-xs">
                          {userRole === 'member' && typeof item.memberPrice === 'number' && item.memberPrice > 0 ? (
                            <span className="text-green-700 font-bold flex items-center">
                              <Crown className="h-4 w-4 text-yellow-500 mr-1" />
                              Member Price: ₹{item.memberPrice.toFixed(2)}
                              <span className="ml-2 text-xs text-muted-foreground line-through">
                                Non-Member: ₹{item.price.toFixed(2)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-primary font-medium flex items-center">
                              Selling Price: ₹{item.price.toFixed(2)}
                            </span>
                          )}
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-muted-foreground line-through flex items-center">
                              <TagIcon className="mr-0.5 h-3 w-3" /> MRP: ₹{item.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {selectedTests.filter(t => !t.prices || t.prices.length === 0).length > 0 && (
                    <li className="p-2.5 border rounded-md bg-muted/50 shadow-sm text-center">
                        <div className="flex items-center justify-center text-xs text-muted-foreground">
                            <Loader2 className="mr-2 h-3 w-3 animate-spin"/> 
                            <span>Prices for some selected tests are still loading...</span>
                        </div>
                    </li>
                  )}
                </ul>
              </ScrollArea>
              
              <div className="space-y-1 text-sm sm:text-base">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center"><Calculator className="mr-1.5 h-4 w-4"/>Total MRP:</span>
                  <span className="font-medium">₹{packageDetails.totalMrp.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-primary">
                  <span className="font-semibold flex items-center"><Tag className="mr-1.5 h-4 w-4"/>Your Price:</span>
                  <span className="font-bold text-xl animate-price-pulse">₹{packageDetails.bestPrice.toFixed(2)}</span>
                </div>
                {packageDetails.totalSavings > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span className="font-semibold flex items-center"><ShieldCheck className="mr-1.5 h-4 w-4"/>You Save:</span>
                    <span className="font-bold">₹{packageDetails.totalSavings.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="p-4 sm:p-5 border-t border-primary/20">
              <Button 
                size="lg" 
                className="w-full py-3 text-base"
                onClick={handleAddToCartPackage}
                disabled={packageDetails.itemsForCart.length === 0 || selectedTests.some(t => !t.prices || t.prices.length === 0)}
              >
                Add Package to Cart ({selectedTests.length} tests)
              </Button>
            </CardFooter>
          </Card>
        )}

        {selectedTests.length > 0 && Object.keys(labsWithTheirSelectedTests).length > 0 && (
          <>
            <div className="flex justify-center mb-2">
              <span className="bouncing-down-arrow">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-arrow-down-circle"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 12 16 16 12"></polyline><line x1="12" y1="8" x2="12" y2="16"></line></svg>
              </span>
            </div>
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center">
                <Microscope className="mr-2 h-6 w-6 text-primary" />
                Available Labs for Your Selected Tests
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(labsWithTheirSelectedTests).map(([labName, offeredTests]) => (
                  <LabGroupedTestCard
                    key={labName}
                    labName={labName}
                    testsOffered={offeredTests}
                    userRole={userRole}
                  />
                ))}
              </div>
            </section>
          </>
        )}
         {selectedTests.length > 0 && Object.keys(labsWithTheirSelectedTests).length === 0 && 
          selectedTests.every(t => t.prices && t.prices.length > 0) && 
         (
             <section className="mt-8">
                <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center">
                    <Microscope className="mr-2 h-6 w-6 text-primary" />
                    Available Labs for Your Selected Tests
                </h2>
                <p className="text-muted-foreground text-center py-6">
                    No labs currently offer the combination of tests you&apos;ve selected. Please try adjusting your selection.
                </p>
             </section>
        )}
        {selectedTests.length > 0 && Object.keys(labsWithTheirSelectedTests).length === 0 && 
         selectedTests.some(t => !t.prices || t.prices.length === 0) && 
         (
             <section className="mt-8">
                <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center">
                    <Microscope className="mr-2 h-6 w-6 text-primary" />
                    Available Labs for Your Selected Tests
                </h2>
                <div className="text-muted-foreground text-center py-6 flex items-center justify-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 
                    <span>Loading price details for all labs...</span>
                </div>
             </section>
        )}

      </main>
      <MultiLabConfirmationDialog
        isOpen={isConfirmationDialogOpen}
        onOpenChange={setIsConfirmationDialogOpen}
        labs={labsForConfirmation}
        onConfirm={handleConfirmMultiLabBooking}
      />
    </div>
  );
}

    
