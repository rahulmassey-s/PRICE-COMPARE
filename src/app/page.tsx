'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { collection, getDocs, query, orderBy, where, limit, doc, getDoc } from 'firebase/firestore';

import { contactDetailsData } from '@/data/app-data';
import type { LabTest, FirestoreTest, FirestoreTestLabPrice, LabPrice as LabPriceType, HealthConcern } from '@/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Search, FileText, Info, UploadCloud, Phone, MessageCircle, Loader2, X as XIcon, AlertTriangle, Package, Eye, Sparkles, FlaskConical, Microscope, Heart, Thermometer, Activity, Bone, Brain, UserCheck, Droplet, Baby, FilterX, ListFilter } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase/client';
import { useToast } from "@/hooks/use-toast";
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const PromotionalBannerCarousel = dynamic(() => import('@/components/promotional-banner-carousel'), {
  loading: () => <Skeleton className="w-full rounded-xl h-[120px] sm:h-[160px] mb-6" />,
  ssr: false
});

const DynamicLabTestCard = dynamic(() => import('@/components/lab-test-card'), {
  loading: () => <Skeleton className="w-[280px] sm:w-[310px] md:w-[330px] h-[450px] sm:h-[480px] rounded-xl" />,
  ssr: false
});

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleComponent,
  DialogDescription as DialogDescriptionComponent,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';

interface HomePageProps { }

const healthConcernIconMap: { [key: string]: React.ElementType } = {
  'full-body-checkups': UserCheck,
  'diabetes': Droplet,
  'heart-health': Heart,
  'fever': Thermometer,
  'thyroid': Activity,
  'bone-health': Bone,
  'brain-health': Brain,
  'pregnancy': Baby,
  'default': FlaskConical,
};


export default function HomePage({ }: HomePageProps) {
  const { toast } = useToast();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [popularLabTests, setPopularLabTests] = useState<LabTest[]>([]);
  const [packageLabTests, setPackageLabTests] = useState<LabTest[]>([]);
  const [quickSelectDisplayTests, setQuickSelectDisplayTests] = useState<Array<Omit<LabTest, 'prices'>>>([]);

  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isLoadingQuickSelect, setIsLoadingQuickSelect] = useState(true);

  const [selectedTestForDetail, setSelectedTestForDetail] = useState<LabTest | null>(null);
  const [isLoadingSingleTest, setIsLoadingSingleTest] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [suggestedQuickTests, setSuggestedQuickTests] = useState<Array<Omit<LabTest, 'prices'>>>([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState<string | null>(null);

  const [dynamicHealthConcerns, setDynamicHealthConcerns] = useState<HealthConcern[]>([]);
  const [isLoadingHealthConcerns, setIsLoadingHealthConcerns] = useState(true);

  const [selectedHealthConcern, setSelectedHealthConcern] = useState<HealthConcern | null>(null);
  const [filteredTestsByConcern, setFilteredTestsByConcern] = useState<LabTest[]>([]);
  const [isLoadingFilteredTests, setIsLoadingFilteredTests] = useState(false);

  const handleFirestoreError = useCallback((error: any, context: string) => {
    console.error(`Firestore error (${context}):`, error);
    let description = `Could not fetch ${context}. Please try again later.`;
    if (error.name === 'FirebaseError') {
      if (error.code === 'unavailable') {
        description = `Connection to our servers failed (${context}). Please check your internet connection and try again.`;
      } else if (error.code === 'failed-precondition' && error.message.includes('index')) {
        description = `Database query failed for ${context} due to a missing index. Please contact support or check Firebase console. Index needed for '${context}'.`;
        console.warn(
          `Firestore indexing issue for ${context}. Query: ${error.message}` +
          ` Check Firebase console for specific index requirements.`
        );
      } else if (error.code === 'permission-denied') {
        description = `Permission denied when fetching ${context}. Please check Firestore security rules.`;
      } else {
        description = `Firebase error (${context}): ${error.message} (Code: ${error.code}).`;
      }
    }
    toast({
      title: `Error Fetching ${context}`,
      description: description,
      variant: "destructive",
    });
  }, [toast]);

  const transformTestDocWithoutPrices = useCallback((testDoc: QueryDocumentSnapshot<DocumentData>): Omit<LabTest, 'prices'> | null => {
    const testData = testDoc.data() as FirestoreTest;
    if (!testData.testName || typeof testData.testName !== 'string' || testData.testName.trim() === '') {
      console.warn(`transformTestDocWithoutPrices: Test document ${testDoc.id} is missing a valid testName. Skipping.`);
      return null;
    }
    const testSlug = testData.testName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    return {
      id: testSlug,
      docId: testDoc.id,
      name: testData.testName,
      imageUrl: testData.imageUrl || testData.testImageUrl,
      description: testData.description,
      bannerText: testData.bannerText, // Ensure bannerText is mapped
      tags: testData.tags,
      healthConcernSlugs: testData.healthConcernSlugs || [],
    };
  }, []);

  const fetchAndAttachPricesToTests = useCallback(async (
    rawTests: Array<Omit<LabTest, 'prices'>>
  ): Promise<LabTest[]> => {
    if (rawTests.length === 0) return [];

    const testIds = rawTests.map(t => t.docId);
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
          });
          labPricesMap.set(priceData.testId, currentPrices);
        });
      }
    }

    for (const [testId, prices] of labPricesMap.entries()) {
      if (prices) {
        prices.sort((a, b) => a.labName.localeCompare(b.labName));
        labPricesMap.set(testId, prices);
      }
    }

    return rawTests.map(test => ({
      ...test,
      prices: labPricesMap.get(test.docId) || [],
    }));
  }, []);

  const fetchCompleteTestDetailsById = useCallback(async (testDocId: string): Promise<LabTest | null> => {
    const testDocRef = doc(db, "tests", testDocId);
    const testDocSnap = await getDoc(testDocRef);

    if (!testDocSnap.exists()) {
      console.warn(`fetchCompleteTestDetailsById: Test document with ID ${testDocId} not found.`);
      return null;
    }

    const testData = testDocSnap.data() as FirestoreTest;
    if (!testData.testName || typeof testData.testName !== 'string' || testData.testName.trim() === '') {
      console.warn(`fetchCompleteTestDetailsById: Test document ${testDocSnap.id} is missing a valid testName.`);
      return null;
    }

    const labPrices: LabPriceType[] = [];
    const testLabPricesQuery = query(
      collection(db, "testLabPrices"),
      where("testId", "==", testDocSnap.id),
      orderBy("labName", "asc")
    );
    const testLabPricesSnapshot = await getDocs(testLabPricesQuery);

    testLabPricesSnapshot.forEach(priceDocSnap => {
      const priceData = priceDocSnap.data() as FirestoreTestLabPrice;
      if (!priceData.labName || typeof priceData.labName !== 'string' || priceData.labName.trim() === '' || typeof priceData.price !== 'number') {
        console.warn(`fetchCompleteTestDetailsById: Price data for testId ${testDocSnap.id}, priceDocId ${priceDocSnap.id} has missing/invalid labName or price. Skipping price entry.`);
        return;
      }
      labPrices.push({
        labName: priceData.labName,
        price: priceData.price,
        originalPrice: typeof priceData.originalPrice === 'number' ? priceData.originalPrice : undefined,
      });
    });

    const testSlug = testData.testName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    return {
      id: testSlug,
      docId: testDocSnap.id,
      name: testData.testName,
      imageUrl: testData.testImageUrl,
      description: testData.description,
      bannerText: testData.bannerText, // Ensure bannerText is mapped
      tags: testData.tags,
      prices: labPrices,
      healthConcernSlugs: testData.healthConcernSlugs || [],
    };
  }, []);

  const fetchSingleTestByName = useCallback(async (testName: string): Promise<LabTest | null> => {
    try {
      const testsCollectionRef = collection(db, "tests");
      const q = query(
        testsCollectionRef,
        where("testName", "==", testName.trim().toUpperCase()), // Assuming testName in DB is uppercase
        where("isActive", "==", true),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        // Attempt to find test by case-insensitive match if uppercase fails (more flexible)
        const allTestsSnapshot = await getDocs(query(testsCollectionRef, where("isActive", "==", true)));
        const foundTest = allTestsSnapshot.docs.find(d => d.data().testName?.toLowerCase() === testName.trim().toLowerCase());
        if (foundTest) {
          return await fetchCompleteTestDetailsById(foundTest.id);
        }
        toast({ title: "Test Not Found", description: `Could not find details for "${testName}". It might be inactive or not exist.`, variant: "default" });
        return null;
      }
      const testDoc = snapshot.docs[0];
      const labTest = await fetchCompleteTestDetailsById(testDoc.id);
      return labTest;
    } catch (error) {
      handleFirestoreError(error, `Test "${testName}"`);
      return null;
    }
  }, [handleFirestoreError, toast, fetchCompleteTestDetailsById]);

  const fetchPopularTests = useCallback(async () => {
    setIsLoadingPopular(true);
    try {
      const testsCollectionRef = collection(db, "tests");
      const firestoreQuery = query(
        testsCollectionRef,
        where("isPopular", "==", true),
        where("isActive", "==", true),
        orderBy("testName", "asc"),
        limit(10)
      );
      const testsSnapshot = await getDocs(firestoreQuery);
      const rawTests: Array<Omit<LabTest, 'prices'>> = [];
      for (const testDoc of testsSnapshot.docs) {
        const transformedDoc = transformTestDocWithoutPrices(testDoc);
        if (transformedDoc) rawTests.push(transformedDoc);
      }
      if (rawTests.length > 0) {
        const testsWithPrices = await fetchAndAttachPricesToTests(rawTests);
        setPopularLabTests(testsWithPrices);
      } else {
        setPopularLabTests([]);
      }
    } catch (error: any) {
      handleFirestoreError(error, "Popular Tests");
      setPopularLabTests([]);
    } finally {
      setIsLoadingPopular(false);
    }
  }, [handleFirestoreError, transformTestDocWithoutPrices, fetchAndAttachPricesToTests]);


  const fetchPackageTests = useCallback(async () => {
    setIsLoadingPackages(true);
    try {
      const testsCollectionRef = collection(db, "tests");
      const firestoreQuery = query(
        testsCollectionRef,
        where("isPackage", "==", true),
        where("isActive", "==", true),
        orderBy("testName", "asc"),
        limit(6)
      );
      const testsSnapshot = await getDocs(firestoreQuery);
      const rawTests: Array<Omit<LabTest, 'prices'>> = [];
      for (const testDoc of testsSnapshot.docs) {
        const transformedDoc = transformTestDocWithoutPrices(testDoc);
        if (transformedDoc) rawTests.push(transformedDoc);
      }
      if (rawTests.length > 0) {
        const testsWithPrices = await fetchAndAttachPricesToTests(rawTests);
        setPackageLabTests(testsWithPrices);
      } else {
        setPackageLabTests([]);
      }
    } catch (error: any) {
      handleFirestoreError(error, "Package Tests");
      setPackageLabTests([]);
    } finally {
      setIsLoadingPackages(false);
    }
  }, [handleFirestoreError, transformTestDocWithoutPrices, fetchAndAttachPricesToTests]);

  const fetchQuickSelectTests = useCallback(async () => {
    setIsLoadingQuickSelect(true);
    try {
      const testsCollectionRef = collection(db, "tests");
      const firestoreQuery = query(
        testsCollectionRef,
        where("isActive", "==", true),
        orderBy("testName", "asc"),
        limit(20)
      );
      const testsSnapshot = await getDocs(firestoreQuery);
      const fetchedTests: Array<Omit<LabTest, 'prices'>> = [];
      for (const testDoc of testsSnapshot.docs) {
        const transformedDoc = transformTestDocWithoutPrices(testDoc);
        if (transformedDoc) fetchedTests.push(transformedDoc);
      }
      setQuickSelectDisplayTests(fetchedTests);
    } catch (error: any) {
      handleFirestoreError(error, "Quick Select Tests");
      setQuickSelectDisplayTests([]);
    } finally {
      setIsLoadingQuickSelect(false);
    }
  }, [handleFirestoreError, transformTestDocWithoutPrices]);

  useEffect(() => {
    const fetchHealthConcerns = async () => {
      setIsLoadingHealthConcerns(true);
      try {
        const concernsRef = collection(db, "healthConcerns");
        const q = query(concernsRef, where("isActive", "==", true), orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedConcerns: HealthConcern[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedConcerns.push({
            id: docSnap.id,
            name: data.name,
            iconUrl: data.iconUrl,
            slug: data.slug,
            order: data.order,
            isActive: data.isActive,
          } as HealthConcern);
        });
        console.log("Fetched Health Concerns for Homepage:", fetchedConcerns); // Debug log
        setDynamicHealthConcerns(fetchedConcerns);
      } catch (error: any) {
        handleFirestoreError(error, "Health Concerns");
        setDynamicHealthConcerns([]);
      } finally {
        setIsLoadingHealthConcerns(false);
      }
    };
    fetchHealthConcerns();
  }, [handleFirestoreError]);

  const handleHealthConcernClick = useCallback((concern: HealthConcern) => {
    if (selectedHealthConcern?.slug === concern.slug) {
      setSelectedHealthConcern(null);
      setFilteredTestsByConcern([]);
    } else {
      setSelectedHealthConcern(concern);
    }
  }, [selectedHealthConcern]);


  useEffect(() => {
    const fetchFilteredTests = async () => {
      if (!selectedHealthConcern) {
        setFilteredTestsByConcern([]);
        return;
      }
      setIsLoadingFilteredTests(true);
      console.log(`Fetching tests for health concern slug: ${selectedHealthConcern.slug}`); // Debug log
      try {
        const testsCollectionRef = collection(db, "tests");
        const firestoreQuery = query(
          testsCollectionRef,
          where("healthConcernSlugs", "array-contains", selectedHealthConcern.slug),
          where("isActive", "==", true),
          orderBy("testName", "asc")
        );
        const testsSnapshot = await getDocs(firestoreQuery);
        console.log(`Found ${testsSnapshot.docs.length} tests for slug ${selectedHealthConcern.slug}`); // Debug log
        const rawTests: Array<Omit<LabTest, 'prices'>> = [];
        testsSnapshot.forEach(doc => {
          const transformed = transformTestDocWithoutPrices(doc);
          if (transformed) rawTests.push(transformed);
        });

        if (rawTests.length > 0) {
          const testsWithPrices = await fetchAndAttachPricesToTests(rawTests);
          setFilteredTestsByConcern(testsWithPrices);
        } else {
          setFilteredTestsByConcern([]);
        }
      } catch (error: any) {
        handleFirestoreError(error, `Tests for ${selectedHealthConcern.name}`);
        setFilteredTestsByConcern([]);
      } finally {
        setIsLoadingFilteredTests(false);
      }
    };

    fetchFilteredTests();
  }, [selectedHealthConcern, transformTestDocWithoutPrices, fetchAndAttachPricesToTests, handleFirestoreError]);


  const handleQuickTestSelect = useCallback(async (testName: string, docIdToFetch?: string) => {
    setIsLoadingSingleTest(true);
    setSelectedTestForDetail(null);
    setIsDetailsDialogOpen(true);
    setActiveSearchQuery(null);
    let testDetails: LabTest | null = null;

    if (docIdToFetch) {
      testDetails = await fetchCompleteTestDetailsById(docIdToFetch);
    } else {
      testDetails = await fetchSingleTestByName(testName);
    }

    if (testDetails) {
      setSelectedTestForDetail(testDetails);
    } else {
      if (docIdToFetch && !testDetails) {
        toast({ title: "Test Not Found", description: `Details for the selected test could not be loaded.`, variant: "default" });
      }
    }
    setIsLoadingSingleTest(false);
  }, [fetchSingleTestByName, fetchCompleteTestDetailsById, toast]);

  const handleOpenTestDetailsDialog = useCallback((test: LabTest) => {
    setSelectedTestForDetail(test);
    setIsDetailsDialogOpen(true);
    setActiveSearchQuery(null);
  }, []);


  const fetchTestSuggestions = useCallback(async (searchTerm: string) => {
    if (searchTerm.trim().length < 2) {
      setSuggestedQuickTests([]);
      setIsSuggestionsVisible(false);
      return;
    }
    setIsLoadingSearch(true);
    setActiveSearchQuery(searchTerm);
    try {
      const testsCollectionRef = collection(db, "tests");
      const searchTermLower = searchTerm.toLowerCase();
      
      // This part needs careful implementation for case-insensitive prefix search
      // Firestore's native querying for case-insensitive prefix search is limited.
      // A common workaround is to store an array of keywords or lowercase name.
      // For simplicity now, we fetch a broader set and filter client-side, or use >= and <= for prefix.
      // This is not ideal for large datasets but can work for smaller ones.
      // A more robust solution involves more complex data structures or external search services (e.g., Algolia).

      const q = query(
        testsCollectionRef,
        where("isActive", "==", true),
        orderBy("testName") // Order by name for potential prefix matching
        // We can't do a direct case-insensitive prefix query easily with Firestore
        // So, we might fetch more and filter, or use >= / <= trick if names are consistently cased.
      );
      const snapshot = await getDocs(q);
      const suggestions: Array<Omit<LabTest, 'prices'>> = [];
      snapshot.forEach(doc => {
        const transformed = transformTestDocWithoutPrices(doc);
        if (transformed && transformed.name.toLowerCase().includes(searchTermLower)) {
          suggestions.push(transformed);
        }
      });
      
      setSuggestedQuickTests(suggestions.slice(0, 5)); // Limit to 5 suggestions client-side
      setIsSuggestionsVisible(true);
    } catch (error) {
      console.error("Error fetching test suggestions:", error);
      handleFirestoreError(error, "Test Suggestions");
      setSuggestedQuickTests([]);
      setIsSuggestionsVisible(false);
    } finally {
      setIsLoadingSearch(false);
    }
  }, [transformTestDocWithoutPrices, handleFirestoreError]);

  const handleLocalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setLocalSearchTerm(term);
    if (term.trim().length === 0) {
      setSuggestedQuickTests([]);
      setIsSuggestionsVisible(false);
      setActiveSearchQuery(null);
    } else if (term.trim().length >= 2) {
      fetchTestSuggestions(term);
    } else {
      setIsSuggestionsVisible(false);
    }
  };

  const handleSuggestionClick = (testName: string, testDocId: string) => {
    setLocalSearchTerm(testName);
    setIsSuggestionsVisible(false);
    setSuggestedQuickTests([]);
    setActiveSearchQuery(testName);
    handleQuickTestSelect(testName, testDocId);
  };

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (localSearchTerm.trim() === '') return;
    setIsLoadingSingleTest(true);
    setIsLoadingSearch(true);
    setActiveSearchQuery(localSearchTerm.trim());
    setIsSuggestionsVisible(false);
    await handleQuickTestSelect(localSearchTerm.trim());
    setIsLoadingSingleTest(false);
    setIsLoadingSearch(false);
  };

  const handleLocalSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  useEffect(() => {
    fetchPopularTests();
    fetchPackageTests();
    fetchQuickSelectTests();
  }, [fetchPopularTests, fetchPackageTests, fetchQuickSelectTests]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSuggestionsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDialogClose = () => {
    setSelectedTestForDetail(null);
    setIsDetailsDialogOpen(false);
    setActiveSearchQuery(null);
  }

  const bookingOptions = [
    {
      label: 'Upload Rx',
      icon: UploadCloud,
      gradientClass: 'booking-card-upload-gradient',
      href: '/upload-prescription',
      dataAiHint: 'medical prescription'
    },
    {
      label: 'Call Us',
      icon: Phone,
      gradientClass: 'booking-card-call-gradient',
      href: `tel:${contactDetailsData.phone}`,
      dataAiHint: 'phone call'
    },
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      gradientClass: 'booking-card-whatsapp-gradient',
      href: `https://wa.me/${contactDetailsData.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(contactDetailsData.whatsappMessage || 'Hello!')}`,
      dataAiHint: 'chat bubble'
    },
  ];

  const renderTestList = (tests: LabTest[], title: string, emptyMessage: string, isLoadingList: boolean, IconComponentProp?: React.ElementType, keyPrefix: string = 'test') => {
    const IconElement = IconComponentProp;
    return (
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center">
            {IconElement && <IconElement size={22} className="mr-2 text-primary" />}
            {title}
            </h2>
            {title.startsWith("Tests for") && ( // Only show Clear Filter for the filtered list
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedHealthConcern(null)}
                    className="text-xs"
                >
                    <FilterX className="mr-1.5 h-3.5 w-3.5" /> Clear Filter
                </Button>
            )}
        </div>

        {isLoadingList ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading...</p>
          </div>
        ) : tests.length > 0 ? (
          <div className="flex overflow-x-auto space-x-4 sm:space-x-6 pb-4 -mx-4 px-4 popular-tests-scrollbar">
            {tests.map(test => (
              <div key={`${keyPrefix}-${test.docId}`} className="w-[280px] sm:w-[310px] md:w-[330px] flex-shrink-0 h-full">
                <DynamicLabTestCard test={test} contactDetails={contactDetailsData} />
              </div>
            ))}
          </div>
        ) : (
          !isLoadingList && (
            <Alert variant="default" className="shadow-md rounded-xl bg-secondary/50">
              {IconElement ? <IconElement className="h-5 w-5 text-secondary-foreground" /> : <Info className="h-5 w-5 text-secondary-foreground" />}
              <AlertTitle className="text-secondary-foreground">{`No ${title.replace(/"/g, '').replace('Popular ','').replace('Package ','')} Available`}</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                {emptyMessage}
              </AlertDescription>
            </Alert>
          )
        )}
      </section>
    )
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow container mx-auto px-4 py-4 overflow-x-hidden">
        <div className="pt-0">

          <PromotionalBannerCarousel
            collectionName="promotionalBanners"
            cardClassName="h-[120px] sm:h-[160px]"
            containerClassName="mb-6"
          />

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">How would you like to book?</h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {bookingOptions.map((option) => (
                <a
                  key={option.label}
                  href={option.href}
                  target={option.label === 'WhatsApp' || option.label === 'Call Us' ? '_blank' : '_self'}
                  rel={option.label === 'WhatsApp' || option.label === 'Call Us' ? 'noopener noreferrer' : ''}
                  className="block group"
                >
                  <Card
                    className={`shadow-md rounded-lg hover:shadow-lg transition-all duration-300 ease-out group-hover:scale-105 ${option.gradientClass} aspect-[4/2.5] sm:aspect-[4/2.5] flex flex-col items-center justify-center p-1.5 sm:p-2 text-center`}
                    data-ai-hint={option.dataAiHint}
                  >
                    <CardContent className="p-0 flex flex-col items-center justify-center">
                      <div className="bg-card/80 rounded-full p-1.5 sm:p-2 mb-1 shadow-lg transition-transform duration-300 group-hover:scale-110">
                        <option.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <p className="text-[10px] sm:text-xs font-medium text-white group-hover:font-semibold leading-tight">{option.label}</p>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="mb-6 sticky top-[60px] sm:top-[68px] z-30 bg-background py-4 shadow-sm -mx-4 px-4">
            <h2 className="text-xl font-bold text-primary mb-2 text-center animate-fade-in-down">
              Looking for a specific test?
            </h2>
            <p className="text-center text-muted-foreground mb-3 text-xs sm:text-sm animate-fade-in-down animation-delay-200">
              Type the test name below to find it quickly.
            </p>
            <div ref={searchContainerRef} className="relative max-w-lg mx-auto animate-fade-in-up animation-delay-400">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 sm:h-5 w-4 sm:h-5 text-primary/70 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search any test & package (e.g., HBA1C)"
                value={localSearchTerm}
                onChange={handleLocalSearchChange}
                onKeyDown={handleLocalSearchKeyDown}
                onFocus={() => { if (localSearchTerm.trim().length >= 2) fetchTestSuggestions(localSearchTerm); }}
                className="w-full pl-10 pr-10 py-3 px-3 text-base rounded-full shadow-md border-border focus:ring-2 focus:ring-primary/50 focus:border-primary"
                aria-label="Search for tests and packages"
                disabled={isLoadingSearch && activeSearchQuery !== null}
              />
              {(isLoadingSearch && activeSearchQuery !== null && localSearchTerm) && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />
              )}
              {localSearchTerm && !isLoadingSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setLocalSearchTerm('');
                    setSuggestedQuickTests([]);
                    setIsSuggestionsVisible(false);
                    setActiveSearchQuery(null);
                  }}
                  aria-label="Clear search"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
              {isSuggestionsVisible && suggestedQuickTests.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                  <ul className="divide-y divide-border">
                    {suggestedQuickTests.map((testSugg) => (
                      <li key={testSugg.docId}>
                        <button
                          type="button"
                          onClick={() => handleSuggestionClick(testSugg.name, testSugg.docId)}
                          className="w-full text-left px-4 py-3 hover:bg-muted transition-colors text-sm text-foreground"
                        >
                          {testSugg.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isSuggestionsVisible && suggestedQuickTests.length === 0 && localSearchTerm.trim().length >= 2 && !isLoadingSearch && (
                <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-xl shadow-xl z-50 p-4">
                  <p className="text-sm text-muted-foreground text-center">No tests found matching "{localSearchTerm}".</p>
                </div>
              )}
            </div>
          </form>

          <Card className="shadow-xl rounded-xl mb-8">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center">
                <Microscope className="h-7 w-7 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
                <div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-foreground">
                    Browse By Health Concern
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Tailor Made Packages Under One Roof
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {isLoadingHealthConcerns ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={`hc-skeleton-${index}`} className="flex flex-col items-center text-center p-1.5 sm:p-2">
                      <Skeleton className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full mb-1.5 sm:mb-2" />
                      <Skeleton className="h-3 w-16 sm:w-20 rounded" />
                    </div>
                  ))}
                </div>
              ) : dynamicHealthConcerns.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {dynamicHealthConcerns.map((concern) => {
                    const IconComp = healthConcernIconMap[concern.slug] || healthConcernIconMap.default;
                    const isSelected = selectedHealthConcern?.slug === concern.slug;
                    return (
                      <button
                        key={concern.slug}
                        onClick={() => handleHealthConcernClick(concern)}
                        className={cn(
                          "flex flex-col items-center justify-start text-center group p-1.5 sm:p-2 hover:bg-primary/5 rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isSelected && "bg-primary/10 ring-2 ring-primary"
                        )}
                        role="button"
                        aria-label={concern.name}
                        aria-pressed={isSelected}
                      >
                        <div className={cn(
                          "relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full overflow-hidden mb-1.5 sm:mb-2",
                          "bg-primary/5 group-hover:bg-primary/10 border-2 border-transparent group-hover:border-primary/30 group-focus-visible:border-primary",
                          "transition-all duration-300 ease-in-out transform group-hover:shadow-lg",
                          isSelected && "border-primary/50 shadow-lg"
                        )}>
                          {concern.iconUrl && concern.iconUrl.trim() !== '' ? (
                            <Image
                              src={concern.iconUrl}
                              alt={concern.name}
                              fill
                              style={{ objectFit: 'cover' }} // Changed from contain to cover
                              className="rounded-full group-hover:scale-110 transition-transform duration-300 ease-in-out"
                              sizes="(max-width: 768px) 30vw, (max-width: 1200px) 20vw, 15vw"
                              data-ai-hint={concern.slug || 'health category'}
                            />
                          ) : (
                            <IconComp className="h-7 w-7 sm:h-8 sm:h-8 text-primary transition-colors duration-200 group-hover:text-primary/80" />
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs font-medium text-foreground whitespace-pre-line leading-tight group-hover:text-primary transition-colors">
                          {concern.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No health concerns found. Please check back later or add some in the admin panel.</p>
              )}
            </CardContent>
          </Card>

          {/* Section for Filtered Tests by Health Concern */}
          {selectedHealthConcern && (
            renderTestList(
              filteredTestsByConcern,
              `Tests for "${selectedHealthConcern.name}"`,
              `No active tests found for "${selectedHealthConcern.name}". Try another category or clear the filter.`,
              isLoadingFilteredTests,
              ListFilter,
              'filtered'
            )
          )}


          <PromotionalBannerCarousel
            collectionName="secondaryPromotionalBanners"
            cardClassName="h-[160px] sm:h-[200px]"
            containerClassName="mb-8"
          />

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <FlaskConical size={22} className="mr-2 text-primary" />
              Select Test
            </h2>
            <Card className="shadow-md rounded-xl p-3 bg-secondary/20">
              <ScrollArea className="w-full whitespace-nowrap rounded-md">
                <div className="flex space-x-3 pb-2">
                  {isLoadingQuickSelect ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <Skeleton key={`quickload-${index}`} className="h-10 w-24 rounded-lg bg-primary/30" />
                    ))
                  ) : quickSelectDisplayTests.length > 0 ? (
                    quickSelectDisplayTests.map((test) => (
                      <Button
                        key={test.docId}
                        variant="default"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-auto py-2.5 px-2.5 text-xs sm:text-sm text-center break-words line-clamp-2 leading-tight shadow-md rounded-lg transition-transform hover:scale-105 active:scale-95"
                        onClick={() => handleQuickTestSelect(test.name, test.docId)}
                        disabled={isLoadingSingleTest && activeSearchQuery === null && selectedTestForDetail?.docId === test.docId}
                      >
                        {(isLoadingSingleTest && activeSearchQuery === null && selectedTestForDetail?.docId === test.docId) ? <Loader2 className="h-4 w-4 animate-spin" /> : test.name}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground px-2">No quick tests available at the moment.</p>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Card>
          </section>

          {renderTestList(popularLabTests, 'Popular Lab Tests', 'There are currently no popular lab tests listed. More tests coming soon or try searching!', isLoadingPopular, Sparkles, 'popular')}
          {renderTestList(packageLabTests, 'Packages', 'No special packages available at the moment. Explore our individual tests or create your own custom package!', isLoadingPackages, Package, 'package')}
        </div>

        <Dialog open={isDetailsDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-[600px] p-0 max-h-[90vh] overflow-hidden flex flex-col rounded-xl">
            {(isLoadingSingleTest || (isLoadingSearch && !!activeSearchQuery && (!selectedTestForDetail || selectedTestForDetail.name.toUpperCase() !== activeSearchQuery.toUpperCase()))) ? (
              <>
                <DialogHeader className="p-4 sm:p-6 border-b bg-secondary/30">
                  <DialogTitleComponent className="text-xl sm:text-2xl text-foreground">Loading Details...</DialogTitleComponent>
                  <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="absolute right-4 top-3 rounded-sm opacity-70 hover:opacity-100">
                      <XIcon className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </DialogClose>
                </DialogHeader>
                <div className="flex-grow flex items-center justify-center p-10 h-64">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              </>
            ) : selectedTestForDetail ? (
              <>
                <DialogHeader className="p-4 sm:p-6 border-b bg-secondary/30">
                  <DialogTitleComponent className="text-xl sm:text-2xl text-foreground">{selectedTestForDetail.name}</DialogTitleComponent>
                  <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="absolute right-4 top-3 rounded-sm opacity-70 hover:opacity-100">
                      <XIcon className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </DialogClose>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto p-1">
                  <DynamicLabTestCard test={selectedTestForDetail} contactDetails={contactDetailsData} onCardClick={() => { /* No action needed for card inside dialog */ }} />
                </div>
              </>
            ) : (
              <>
                <DialogHeader className="p-4 sm:p-6 border-b bg-secondary/30">
                  <DialogTitleComponent className="text-xl sm:text-2xl text-destructive-foreground">Test Not Found</DialogTitleComponent>
                  <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="absolute right-4 top-3 rounded-sm opacity-70 hover:opacity-100">
                      <XIcon className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </DialogClose>
                </DialogHeader>
                <div className="flex-grow flex flex-col items-center justify-center p-6 sm:p-10 text-center">
                  <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
                  <p className="text-muted-foreground">
                    {activeSearchQuery ? `The test "${activeSearchQuery}" could not be found or is currently inactive.` : 'Could not load test details.'}
                  </p>
                  <Button variant="outline" onClick={handleDialogClose} className="mt-4">Close</Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>


        <style jsx global>{`
          body { 
            --header-height-sticky-search: 60px;
            --header-height-sticky-search-sm: 68px;
          }
          .popular-tests-scrollbar::-webkit-scrollbar { height: 8px; }
          .popular-tests-scrollbar::-webkit-scrollbar-track { background: hsl(var(--muted) / 0.5); border-radius: 10px; }
          .popular-tests-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.7); border-radius: 10px; }
          .popular-tests-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary)); }
          .popular-tests-scrollbar { scrollbar-width: thin; scrollbar-color: hsl(var(--primary) / 0.7) hsl(var(--muted) / 0.5); }

          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-10px); } 
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-down { animation: fadeInDown 0.5s ease-out forwards; } 

          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); } 
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; } 
          
          .animation-delay-200 { animation-delay: 0.1s; } 
          .animation-delay-400 { animation-delay: 0.2s; } 
        `}</style>
      </main>
    </div>
  );
}

    
